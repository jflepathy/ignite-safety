import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { z } from 'zod';
import { syncLedger } from '@/lib/ledger';
import { closedPeriodResponse } from '@/lib/period-lock';
import { recomputeInvoiceBalance } from '@/lib/invoice-balance';


const PaymentSchema = z.object({
  amount: z.number().positive(),
  method: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'OTHER']),
  bankAccountId: z.string().min(1, 'Select which account this payment was deposited into'),
  reference: z.string().optional(),
  notes: z.string().optional(),
  paidAt: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;

  const body = await req.json();
  const parsed = PaymentSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  const invoice = await prisma.invoice.findUnique({ where: { id: params.id }, include: { payments: true } });
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const locked = await closedPeriodResponse(data.paidAt ? new Date(data.paidAt) : new Date());
  if (locked) return locked;

  const bankAccount = await prisma.bankAccount.findUnique({ where: { id: data.bankAccountId } });
  if (!bankAccount) return NextResponse.json({ error: 'That account no longer exists' }, { status: 400 });

  const payment = await prisma.payment.create({
    data: {
      invoiceId: params.id,
      amount: data.amount,
      method: data.method,
      bankAccountId: data.bankAccountId,
      reference: data.reference,
      notes: data.notes,
      paidAt: data.paidAt ? new Date(data.paidAt) : new Date(),
      recordedById: session!.user.id,
    },
  });

  // Sequential write, not $transaction() -- the Neon HTTP driver adapter
  // doesn't support it (see the numbering/deposits routes for the same
  // pattern). The balance bump is a single atomic `increment`.
  // Bank balance now comes from the ledger (see src/lib/ledger.ts).
  if (invoice.status === 'DRAFT') await prisma.invoice.update({ where: { id: params.id }, data: { status: 'SENT' } });
  await recomputeInvoiceBalance(params.id);
  await syncLedger([
    { type: 'INVOICE', id: params.id },
    { type: 'PAYMENT', id: payment.id },
  ]);
  const updated = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: { payments: true, customer: true, lineItems: true },
  });

  return NextResponse.json({ payment, invoice: updated }, { status: 201 });
}
