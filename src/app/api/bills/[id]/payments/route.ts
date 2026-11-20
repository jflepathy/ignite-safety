import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { z } from 'zod';
import { syncLedger } from '@/lib/ledger';
import { closedPeriodResponse } from '@/lib/period-lock';

const Schema = z.object({
  amount: z.number().positive(),
  method: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'OTHER']),
  reference: z.string().optional(),
  bankAccountId: z.string().min(1, 'Select the account the bill was paid from'),
  paidAt: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;
  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const bill = await prisma.bill.findUnique({ where: { id: params.id }, include: { lineItems: true } });
  if (!bill) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const paidAt = parsed.data.paidAt ? new Date(parsed.data.paidAt) : new Date();
  const locked = await closedPeriodResponse(paidAt);
  if (locked) return locked;
  const sp = await prisma.supplierPayment.create({
    data: {
      billId: params.id,
      amount: parsed.data.amount,
      method: parsed.data.method,
      reference: parsed.data.reference,
      bankAccountId: parsed.data.bankAccountId,
      paidAt,
    },
  });

  const totalPaid = bill.lineItems.reduce((s, p) => s + Number(p.amount), 0) + parsed.data.amount;
  const total = Number(bill.total);
  const balanceDue = Math.max(total - totalPaid, 0);
  const status = balanceDue <= 0 ? 'PAID' : totalPaid > 0 ? 'PARTIAL' : 'OPEN';

  await prisma.bill.update({
    where: { id: params.id },
    data: { amountPaid: totalPaid, balanceDue, status },
  });
  const updated = await prisma.bill.findUnique({ where: { id: params.id }, include: { supplier: true } });

  await syncLedger([{ type: 'BILL_PAYMENT', id: sp.id }]);
  return NextResponse.json(updated, { status: 201 });
}
