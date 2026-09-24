import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { computeDocumentTotals } from '@/lib/money';
import { z } from 'zod';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;

  const estimate = await prisma.estimate.findUnique({
    where: { id: params.id },
    include: {
      customer: true,
      lineItems: { include: { taxRate: true }, orderBy: { sortOrder: 'asc' } },
    },
  });
  if (!estimate) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(estimate);
}

const LineItemSchema = z.object({
  shopItemId: z.string().optional().nullable(),
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  discountPercent: z.number().min(0).max(100).default(0),
  taxRateId: z.string().optional().nullable(),
  taxRatePercent: z.number().min(0).max(100).default(0),
});

const UpdateSchema = z.object({
  customerId: z.string().min(1).optional(),
  expiryDate: z.string().optional().nullable(),
  globalDiscountPercent: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
  customerMessage: z.string().optional(),
  taxInclusive: z.boolean().optional(),
  lineItems: z.array(LineItemSchema).optional(),
});

// Edits an existing Estimate/Quote in place — its number stays the same, and
// (unlike the Invoice edit route) there's no payments/status complication to
// worry about since nothing has been billed yet. Mirrors the Invoice PATCH
// handler's two-step write pattern (plain update() + a separate
// include-fetch, never update({ include }) in one call, and line items
// deleted-then-recreated one row at a time) — the Neon HTTP adapter can't
// run the implicit transaction either of those would otherwise need.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;

  const body = await req.json();
  // Drop an untouched blank line (no item, nothing typed) before validation
  // — same rule as the Invoice/Estimate create routes, so an auto-added
  // blank row under a just-picked item never blocks Save.
  if (Array.isArray((body as any)?.lineItems)) {
    (body as any).lineItems = (body as any).lineItems.filter(
      (l: any) => (l?.description ?? '').trim() !== '' || !!l?.shopItemId
    );
  }
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  const existing = await prisma.estimate.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let totalsPatch = {};
  if (data.lineItems) {
    const totals = computeDocumentTotals(
      data.lineItems.map((li) => ({
        quantity: li.quantity,
        unitPrice: li.unitPrice,
        discountPercent: li.discountPercent,
        taxRatePercent: li.taxRatePercent,
      })),
      data.globalDiscountPercent ?? Number(existing.globalDiscountPercent),
      data.taxInclusive ?? existing.taxInclusive
    );
    await prisma.estimateLineItem.deleteMany({ where: { estimateId: params.id } });
    for (let idx = 0; idx < data.lineItems.length; idx++) {
      const li = data.lineItems[idx];
      await prisma.estimateLineItem.create({
        data: {
          estimateId: params.id,
          shopItemId: li.shopItemId || null,
          description: li.description,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          discountPercent: li.discountPercent,
          taxRateId: li.taxRateId || null,
          lineTotal: totals.lines[idx].lineTotal,
          sortOrder: idx,
        },
      });
    }
    totalsPatch = {
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      taxTotal: totals.taxTotal,
      total: totals.total,
    };
  }

  await prisma.estimate.update({
    where: { id: params.id },
    data: {
      ...(data.customerId ? { customerId: data.customerId } : {}),
      ...(data.expiryDate !== undefined ? { expiryDate: data.expiryDate ? new Date(data.expiryDate) : null } : {}),
      ...(data.globalDiscountPercent !== undefined ? { globalDiscountPercent: data.globalDiscountPercent } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
      ...(data.customerMessage !== undefined ? { customerMessage: data.customerMessage } : {}),
      ...(data.taxInclusive !== undefined ? { taxInclusive: data.taxInclusive } : {}),
      ...totalsPatch,
    },
  });

  const estimate = await prisma.estimate.findUnique({
    where: { id: params.id },
    include: { lineItems: true, customer: true },
  });

  return NextResponse.json(estimate);
}

// Session 22, round 10 — soft-delete into the Recycle Bin, admin-only. See
// the matching comment on customers/[id]/route.ts's DELETE handler. Line
// items cascade automatically (EstimateLineItem.estimate has onDelete:
// Cascade), but that's irrelevant here since this never touches the row
// itself — only deletedAt is set.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireRole('ADMIN');
  if (error) return error;
  const existing = await prisma.estimate.findUnique({ where: { id: params.id } });
  if (!existing || existing.deletedAt) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await prisma.estimate.update({ where: { id: params.id }, data: { deletedAt: new Date() } });
  await prisma.auditLog.create({
    data: {
      userId: session!.user.id,
      action: 'ESTIMATE_DELETED',
      entityType: 'Estimate',
      entityId: params.id,
      metadata: { estimateNumber: existing.estimateNumber },
    },
  });
  return NextResponse.json({ ok: true });
}

