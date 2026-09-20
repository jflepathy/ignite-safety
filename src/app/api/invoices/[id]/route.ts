import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { computeDocumentTotals } from '@/lib/money';
import { z } from 'zod';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;

  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: {
      customer: true,
      lineItems: { include: { taxRate: true }, orderBy: { sortOrder: 'asc' } },
      payments: { orderBy: { paidAt: 'desc' } },
      workOrder: true,
    },
  });
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(invoice);
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
  status: z.enum(['DRAFT', 'SENT', 'PARTIAL', 'PAID', 'OVERDUE', 'VOID']).optional(),
  dueDate: z.string().optional().nullable(),
  globalDiscountPercent: z.number().min(0).max(100).optional(),
  terms: z.string().optional(),
  notes: z.string().optional(),
  lineItems: z.array(LineItemSchema).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;

  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  const existing = await prisma.invoice.findUnique({ where: { id: params.id }, include: { payments: true } });
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
      data.globalDiscountPercent ?? Number(existing.globalDiscountPercent)
    );
    const amountPaid = existing.payments.reduce((s, p) => s + Number(p.amount), 0);
    await prisma.invoiceLineItem.deleteMany({ where: { invoiceId: params.id } });
    await prisma.invoiceLineItem.createMany({
      data: data.lineItems.map((li, idx) => ({
        invoiceId: params.id,
        shopItemId: li.shopItemId || null,
        description: li.description,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
        discountPercent: li.discountPercent,
        taxRateId: li.taxRateId || null,
        lineTotal: totals.lines[idx].lineTotal,
        sortOrder: idx,
      })),
    });
    totalsPatch = {
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      taxTotal: totals.taxTotal,
      total: totals.total,
      balanceDue: Math.max(totals.total - amountPaid, 0),
    };
  }

  const invoice = await prisma.invoice.update({
    where: { id: params.id },
    data: {
      ...(data.status ? { status: data.status } : {}),
      ...(data.dueDate !== undefined ? { dueDate: data.dueDate ? new Date(data.dueDate) : null } : {}),
      ...(data.globalDiscountPercent !== undefined
        ? { globalDiscountPercent: data.globalDiscountPercent }
        : {}),
      ...(data.terms !== undefined ? { terms: data.terms } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
      ...totalsPatch,
    },
    include: { lineItems: true, customer: true, payments: true },
  });

  return NextResponse.json(invoice);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireRole('ADMIN');
  if (error) return error;
  await prisma.invoice.update({ where: { id: params.id }, data: { deletedAt: new Date(), status: 'VOID' } });
  return NextResponse.json({ ok: true });
}
