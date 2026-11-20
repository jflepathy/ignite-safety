import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { syncLedger } from '@/lib/ledger';
import { closedPeriodResponse } from '@/lib/period-lock';

/** Undo a deposit: its items go back to Undeposited Funds. */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireRole('ADMIN');
  if (error) return error;
  const deposit = await prisma.deposit.findUnique({ where: { id: params.id } });
  if (!deposit) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const locked = await closedPeriodResponse(deposit.date);
  if (locked) return locked;
  await prisma.deposit.delete({ where: { id: deposit.id } });
  await syncLedger([{ type: 'DEPOSIT', id: deposit.id }]);
  return NextResponse.json({ ok: true });
}
