import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { nextDocumentNumber } from '@/lib/numbering';
import { z } from 'zod';

export async function GET() {
  const { error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;
  const pos = await prisma.purchaseOrder.findMany({
    include: { supplier: true, lineItems: true },
    orderBy: { orderDate: 'desc' },
  });
  return NextResponse.json(pos);
}

const LineSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  shopItemId: z.string().optional().nullable(),
});

const CreateSchema = z.object({
  supplierId: z.string().min(1),
  expectedDate: z.string().optional(),
  notes: z.string().optional(),
  lineItems: z.array(LineSchema).min(1),
});

export async function POST(req: NextRequest) {
  const { error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;
  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  const lineTotals = data.lineItems.map((l) => Math.round(l.quantity * l.unitPrice * 100) / 100);
  const total = Math.round(lineTotals.reduce((s, n) => s + n, 0) * 100) / 100;

  const poNumber = await nextDocumentNumber('purchaseOrderNextSeq', 'purchaseOrderPrefix');

  // Two-step create — the Neon HTTP adapter can't run the implicit
  // transaction a nested relational `create` normally needs (see the same
  // note in src/app/api/invoices/route.ts).
  const createdPo = await prisma.purchaseOrder.create({
    data: {
      poNumber,
      supplierId: data.supplierId,
      expectedDate: data.expectedDate ? new Date(data.expectedDate) : null,
      notes: data.notes,
      subtotal: total,
      total,
    },
  });

  // createMany() also requires a transaction under the Neon HTTP adapter
  // (confirmed by direct testing — not just nested `create`), so rows go
  // in one at a time.
  for (let idx = 0; idx < data.lineItems.length; idx++) {
    const l = data.lineItems[idx];
    await prisma.purchaseOrderLineItem.create({
      data: {
        purchaseOrderId: createdPo.id,
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        shopItemId: l.shopItemId || null,
        lineTotal: lineTotals[idx],
      },
    });
  }

  const po = await prisma.purchaseOrder.findUnique({
    where: { id: createdPo.id },
    include: { supplier: true, lineItems: true },
  });

  return NextResponse.json(po ?? createdPo, { status: 201 });
}
