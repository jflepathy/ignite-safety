import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireEdit } from '@/lib/api-auth';
import { z } from 'zod';
import { syncLedger } from '@/lib/ledger';
import { closedPeriodResponse } from '@/lib/period-lock';

const UpdateSchema = z.object({
  accountId: z.string().min(1).optional(),
  supplierId: z.string().optional().nullable(),
  vendor: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  amount: z.number().positive().optional(),
  method: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'OTHER']).optional(),
  date: z.string().optional(),
  reference: z.string().optional().nullable(),
  bankAccountId: z.string().min(1).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireEdit('expenseTransactions', 'ADMIN', 'SALES');
  if (error) return error;
  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { date, accountId, ...rest } = parsed.data;

  const existing = await prisma.expense.findUnique({ where: { id: params.id }, select: { date: true } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const locked = await closedPeriodResponse(existing.date, date ? new Date(date) : null);
  if (locked) return locked;
  const data: Record<string, unknown> = { ...rest };
  if (date !== undefined) data.date = date ? new Date(date) : undefined;
  if (accountId !== undefined) {
    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account || account.type !== 'EXPENSE') {
      return NextResponse.json({ error: 'Selected category must be an active Expense account.' }, { status: 400 });
    }
    data.accountId = accountId;
    data.category = account.name;
  }

  const expense = await prisma.expense.update({ where: { id: params.id }, data });
  await syncLedger([{ type: 'EXPENSE', id: params.id }]);
  return NextResponse.json(expense);
}
