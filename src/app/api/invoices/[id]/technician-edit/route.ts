import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { isStaleAssignment } from '@/lib/work-order-status';
import { computeDocumentTotals } from '@/lib/money';
import { z } from 'zod';

// Lets a technician adjust the line items on the DRAFT invoice the billing
// bridge auto-raised from their Work Order, before they share it or collect
// payment on it — the auto-populated lines can be wrong (a missed item, a
// quantity that needs correcting) and previously there was no way to fix
// that short of asking the office to edit it from the desktop Invoice
// screen, which a technician can't reach.
//
// Deliberately its own endpoint (not the shared ADMIN/SALES-only
// PATCH /api/invoices/[id]) so it can be technician-reachable but scoped
// tightly: only their own job's invoice, and only while it's still DRAFT —
// once it's been sent or any payment recorded against it, further changes
// go through the office instead.
const LineItemSchema = z.object({
  shopItemId: z.string().optional().nullable(),
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
});

const Schema = z.object({
  lineItems: z.array(LineItemSchema).min(1),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireRole('ADMIN', 'TECHNICIAN');
  if (error) return error;

  const body = await req.json();
  if (Array.isArray((body as any)?.lineItems)) {
    (body as any).lineItems = (body as any).lineItems.filter(
      (l: any) => (l?.description ?? '').trim() !== '' || !!l?.shopItemId
    );
  }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  const invoice = await prisma.invoice.findUnique({ where: { id: params.id }, include: { workOrder: true } });
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (session!.user.role === 'TECHNICIAN') {
    const wo = invoice.workOrder;
    if (!wo || (wo.assignedTechnicianId !== session!.user.id && !isStaleAssignment(wo))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }
  if (invoice.status !== 'DRAFT') {
    return NextResponse.json(
      { error: { formErrors: ['This invoice has already been sent or paid — ask the office to make changes.'] } },
      { status: 400 }
    );
  }

  const totals = computeDocumentTotals(
    data.lineItems.map((li) => ({ quantity: li.quantity, unitPrice: li.unitPrice, discountPercent: 0, taxRatePercent: 0 })),
    0,
    false
  );

  // Rows go in one at a time — createMany()/nested create both require an
  // implicit transaction the Neon HTTP adapter can't run. Same pattern as
  // every other line-item write in this app (see PATCH /api/invoices/[id]).
  await prisma.invoiceLineItem.deleteMany({ where: { invoiceId: params.id } });
  for (let idx = 0; idx < data.lineItems.length; idx++) {
    const li = data.lineItems[idx];
    await prisma.invoiceLineItem.create({
      data: {
        invoiceId: params.id,
        shopItemId: li.shopItemId || null,
        description: li.description,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
        discountPercent: 0,
        lineTotal: totals.lines[idx].lineTotal,
        sortOrder: idx,
      },
    });
  }

  await prisma.invoice.update({
    where: { id: params.id },
    data: {
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      taxTotal: totals.taxTotal,
      total: totals.total,
      balanceDue: totals.total,
    },
  });

  const updated = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: { lineItems: true, customer: true },
  });
  return NextResponse.json(updated);
}
