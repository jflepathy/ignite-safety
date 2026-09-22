import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { nextDocumentNumber } from '@/lib/numbering';
import { computeDocumentTotals } from '@/lib/money';
import { z } from 'zod';

export async function GET() {
  const { error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;
  const orders = await prisma.salesOrder.findMany({
    include: { customer: true, lineItems: true },
    orderBy: { orderDate: 'desc' },
  });
  return NextResponse.json(orders);
}

const LineSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  taxRateId: z.string().optional().nullable(),
  taxRatePercent: z.number().min(0).max(100).default(0),
});

const CreateSchema = z.object({
  customerId: z.string().min(1),
  globalDiscountPercent: z.number().min(0).max(100).default(0),
  notes: z.string().optional(),
  lineItems: z.array(LineSchema).min(1),
});

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;
  const body = await req.json();
  // A line item with no shop item picked and no description typed is an
  // untouched blank row (most commonly the auto-added line beneath a
  // just-picked item) — drop it before validation instead of failing the
  // whole save on "String must contain at least 1 character(s)".
  if (Array.isArray((body as any)?.lineItems)) {
    (body as any).lineItems = (body as any).lineItems.filter(
      (l: any) => (l?.description ?? '').trim() !== '' || !!l?.shopItemId
    );
  }
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  const totals = computeDocumentTotals(data.lineItems, data.globalDiscountPercent);
  const orderNumber = await nextDocumentNumber('salesOrderNextSeq', 'salesOrderPrefix');

  // Two-step create — the Neon HTTP adapter can't run the implicit
  // transaction a nested relational `create` normally needs (see the same
  // note in src/app/api/invoices/route.ts).
  const createdOrder = await prisma.salesOrder.create({
    data: {
      orderNumber,
      customerId: data.customerId,
      globalDiscountPercent: data.globalDiscountPercent,
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      taxTotal: totals.taxTotal,
      total: totals.total,
      notes: data.notes,
      createdById: session!.user.id,
    },
  });

  // createMany() also requires a transaction under the Neon HTTP adapter
  // (confirmed by direct testing — not just nested `create`), so rows go
  // in one at a time.
  for (let idx = 0; idx < data.lineItems.length; idx++) {
    const li = data.lineItems[idx];
    await prisma.salesOrderLineItem.create({
      data: {
        salesOrderId: createdOrder.id,
        description: li.description,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
        taxRateId: li.taxRateId || null,
        lineTotal: totals.lines[idx].lineTotal,
        sortOrder: idx,
      },
    });
  }

  const order = await prisma.salesOrder.findUnique({
    where: { id: createdOrder.id },
    include: { lineItems: true, customer: true },
  });

  return NextResponse.json(order ?? createdOrder, { status: 201 });
}
