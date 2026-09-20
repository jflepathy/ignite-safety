import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';

export async function GET() {
  const { error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;
  const accounts = await prisma.bankAccount.findMany({
    include: { account: true, transactions: { orderBy: { date: 'desc' }, take: 20 } },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json(accounts);
}
