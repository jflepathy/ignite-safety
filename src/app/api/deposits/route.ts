import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { z } from 'zod';
import { syncLedger } from '@/lib/ledger';
import { closedPeriodResponse } from '@/lib/period-lock';
import { undepositedItems } from '@/lib/deposits';

export async function GET() {
  const { error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;
  const deposits = await prisma.deposit.findMany({ include: { bankAccount: true }, orderBy: { date: 'desc' } });
  return NextResponse.json(deposits);
}

/**
 * A deposit moves money that was received into "Undeposited Funds" (payments /
 * sales receipts saved without a bank account) into a real bank or cash
 * account. Its amount is the sum of the items picked, so the books can't
 * double-count: money recorded straight into a bank never shows up here.
 */
const CreateSchema = z.object({
  bankAccountId: z.string().min(1),
  date: z.string().optional(),
  memo: z.string().optional(),
  paymentIds: z.array(z.string()).default([]),
  receiptIds: z.array(z.string()).default([]),
});

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;
  const parsed = CreateSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { bankAccountId, date, memo, paymentIds, receiptIds } = parsed.data;
  if (paymentIds.length + receiptIds.length === 0) {
    return NextResponse.json({ error: { formErrors: ['Pick at least one payment or receipt to deposit.'] } }, { status: 400 });
  }
  const when = date ? new Date(date) : new Date();
  const locked = await closedPeriodResponse(when);
  if (locked) return locked;
  const bank = await prisma.bankAccount.findUnique({ where: { id: bankAccountId } });
  if (!bank) return NextResponse.json({ error: { formErrors: ['That account no longer exists.'] } }, { status: 400 });

  const open = await undepositedItems();
  const pick = open.filter((i) => (i.kind === 'payment' ? paymentIds.includes(i.id) : receiptIds.includes(i.id)));
  if (pick.length !== paymentIds.length + receiptIds.length) {
    return NextResponse.json({ error: { formErrors: ['Some of the selected items were already deposited. Refresh and try again.'] } }, { status: 409 });
  }
  const amount = Math.round(pick.reduce((s, i) => s + i.amount, 0) * 100) / 100;

  const deposit = await prisma.deposit.create({
    data: { bankAccountId, date: when, amount, memo: memo || null, paymentIds, receiptIds, createdById: session!.user.id },
  });
  await syncLedger([{ type: 'DEPOSIT', id: deposit.id }]);
  return NextResponse.json(deposit, { status: 201 });
}
