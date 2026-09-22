import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { nextDocumentNumber } from '@/lib/numbering';
import { z } from 'zod';

export async function GET() {
  const { error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;
  const expenses = await prisma.expense.findMany({ orderBy: { date: 'desc' }, take: 200 });
  return NextResponse.json(expenses);
}

// Expenses must link to a Chart-of-Accounts record (Section 3: "Ensure all
// expense entries link strictly to pre-defined Chart of Accounts records").
// A supplier can optionally be mapped from the Supplier list; if none is
// selected, a free-text vendor name may be recorded instead.
const CreateSchema = z.object({
  accountId: z.string().min(1, 'A Chart of Accounts category is required.'),
  supplierId: z.string().optional(),
  vendor: z.string().optional(),
  description: z.string().optional(),
  amount: z.number().positive(),
  method: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'OTHER']),
  date: z.string().optional(),
  reference: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const { error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;
  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { date, accountId, ...rest } = parsed.data;

  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account || account.type !== 'EXPENSE') {
    return NextResponse.json({ error: 'Selected category must be an active Expense account.' }, { status: 400 });
  }

  const expenseNumber = await nextDocumentNumber('expenseNextSeq', 'expensePrefix');
  const expense = await prisma.expense.create({
    data: { ...rest, accountId, category: account.name, date: date ? new Date(date) : new Date(), expenseNumber },
  });
  return NextResponse.json(expense, { status: 201 });
}
