import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { nextDocumentNumber } from '@/lib/numbering';
import { z } from 'zod';

export async function GET() {
  const { error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;
  const bills = await prisma.bill.findMany({
    include: { supplier: true, lineItems: true, billLineItems: true },
    orderBy: { billDate: 'desc' },
  });
  return NextResponse.json(bills);
}

const LineSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  accountId: z.string().optional().nullable(),
  shopItemId: z.string().optional().nullable(),
});

const CreateSchema = z.object({
  supplierId: z.string().min(1),
  supplierRef: z.string().optional(),
  dueDate: z.string().optional(),
  terms: z.string().optional(),
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
  const subtotal = Math.round(lineTotals.reduce((s, n) => s + n, 0) * 100) / 100;

  const billNumber = await nextDocumentNumber('billNextSeq', 'billPrefix');

  // Two-step create — the Neon HTTP adapter can't run the implicit
  // transaction a nested relational `create` normally needs (see the same
  // note in src/app/api/invoices/route.ts).
  const createdBill = await prisma.bill.create({
    data: {
      billNumber,
      supplierId: data.supplierId,
      supplierRef: data.supplierRef,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      terms: data.terms,
      notes: data.notes,
      subtotal,
      taxTotal: 0,
      total: subtotal,
      balanceDue: subtotal,
    },
  });

  // createMany() also requires a transaction under the Neon HTTP adapter
  // (confirmed by direct testing — not just nested `create`), so rows go
  // in one at a time.
  for (let idx = 0; idx < data.lineItems.length; idx++) {
    const l = data.lineItems[idx];
    await prisma.billLineItem.create({
      data: {
        billId: createdBill.id,
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        accountId: l.accountId || null,
        shopItemId: l.shopItemId || null,
        lineTotal: lineTotals[idx],
      },
    });
  }

  const bill = await prisma.bill.findUnique({
    where: { id: createdBill.id },
    include: { supplier: true, billLineItems: true },
  });

  return NextResponse.json(bill ?? createdBill, { status: 201 });
}
