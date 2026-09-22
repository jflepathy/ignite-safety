import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { nextDocumentNumber } from '@/lib/numbering';
import { z } from 'zod';

export async function GET() {
  const { error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;
  const refunds = await prisma.refundReceipt.findMany({
    include: { customer: true, lineItems: true },
    orderBy: { refundDate: 'desc' },
  });
  return NextResponse.json(refunds);
}

const LineSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
});

const CreateSchema = z.object({
  customerId: z.string().min(1),
  invoiceId: z.string().optional().nullable(),
  method: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'OTHER']).default('CASH'),
  reason: z.string().optional(),
  lineItems: z.array(LineSchema).min(1),
});

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;
  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  const lineTotals = data.lineItems.map((l) => Math.round(l.quantity * l.unitPrice * 100) / 100);
  const total = Math.round(lineTotals.reduce((s, n) => s + n, 0) * 100) / 100;
  const refundNumber = await nextDocumentNumber('refundReceiptNextSeq', 'refundReceiptPrefix');

  // Two-step create — the Neon HTTP adapter can't run the implicit
  // transaction a nested relational `create` normally needs (see the same
  // note in src/app/api/invoices/route.ts).
  const createdRefund = await prisma.refundReceipt.create({
    data: {
      refundNumber,
      customerId: data.customerId,
      invoiceId: data.invoiceId || null,
      method: data.method,
      reason: data.reason,
      subtotal: total,
      total,
      createdById: session!.user.id,
    },
  });

  // createMany() also requires a transaction under the Neon HTTP adapter
  // (confirmed by direct testing — not just nested `create`), so rows go
  // in one at a time.
  for (let idx = 0; idx < data.lineItems.length; idx++) {
    const li = data.lineItems[idx];
    await prisma.refundReceiptLineItem.create({
      data: {
        refundReceiptId: createdRefund.id,
        description: li.description,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
        lineTotal: lineTotals[idx],
      },
    });
  }

  const refund = await prisma.refundReceipt.findUnique({
    where: { id: createdRefund.id },
    include: { lineItems: true, customer: true },
  });

  return NextResponse.json(refund ?? createdRefund, { status: 201 });
}
