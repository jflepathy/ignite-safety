import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { nextDocumentNumber } from '@/lib/numbering';
import { computeDocumentTotals } from '@/lib/money';
import { z } from 'zod';

export async function GET() {
  const { error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;
  const receipts = await prisma.salesReceipt.findMany({
    include: { customer: true, lineItems: true },
    orderBy: { saleDate: 'desc' },
  });
  return NextResponse.json(receipts);
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
  paymentMethod: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'OTHER']).default('CASH'),
  notes: z.string().optional(),
  lineItems: z.array(LineSchema).min(1),
});

// A Sales Receipt records an immediate, fully-paid sale — unlike an
// Invoice it never carries an A/R balance.
export async function POST(req: NextRequest) {
  const { session, error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;
  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  const totals = computeDocumentTotals(data.lineItems, 0);
  const receiptNumber = await nextDocumentNumber('salesReceiptNextSeq', 'salesReceiptPrefix');

  const receipt = await prisma.salesReceipt.create({
    data: {
      receiptNumber,
      customerId: data.customerId,
      paymentMethod: data.paymentMethod,
      subtotal: totals.subtotal,
      taxTotal: totals.taxTotal,
      total: totals.total,
      notes: data.notes,
      createdById: session!.user.id,
      lineItems: {
        create: data.lineItems.map((li, idx) => ({
          description: li.description,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          taxRateId: li.taxRateId || null,
          lineTotal: totals.lines[idx].lineTotal,
        })),
      },
    },
    include: { lineItems: true, customer: true },
  });

  return NextResponse.json(receipt, { status: 201 });
}
