import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  const { error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;

  const from = req.nextUrl.searchParams.get('from');
  const to = req.nextUrl.searchParams.get('to');
  const dateFilter = {
    ...(from ? { gte: new Date(from) } : {}),
    ...(to ? { lte: new Date(to) } : {}),
  };

  const [payments, expenses] = await Promise.all([
    prisma.payment.findMany({
      where: Object.keys(dateFilter).length ? { paidAt: dateFilter } : {},
      select: { amount: true, paidAt: true, method: true },
    }),
    prisma.expense.findMany({
      where: Object.keys(dateFilter).length ? { date: dateFilter } : {},
    }),
  ]);

  const income = payments.reduce((s, p) => s + Number(p.amount), 0);
  const expenseTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);

  const byCategory: Record<string, number> = {};
  for (const e of expenses) {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + Number(e.amount);
  }

  return NextResponse.json({
    income,
    expenseTotal,
    net: income - expenseTotal,
    expensesByCategory: byCategory,
    paymentCount: payments.length,
    expenseCount: expenses.length,
  });
}
