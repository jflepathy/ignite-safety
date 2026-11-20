import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { z } from 'zod';
import { syncLedger } from '@/lib/ledger';
import { closedPeriodResponse } from '@/lib/period-lock';

export async function GET() {
  const { error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;
  const transfers = await prisma.accountTransfer.findMany({
    include: { fromAccount: true, toAccount: true },
    orderBy: { date: 'desc' },
  });
  return NextResponse.json(transfers);
}

const CreateSchema = z.object({
  fromAccountId: z.string().min(1),
  toAccountId: z.string().min(1),
  amount: z.number().positive(),
  memo: z.string().optional(),
  date: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;
  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  if (parsed.data.fromAccountId === parsed.data.toAccountId) {
    return NextResponse.json({ error: 'From and To accounts must differ' }, { status: 400 });
  }
  const { date, ...rest } = parsed.data;
  const when = date ? new Date(date) : new Date();
  const locked = await closedPeriodResponse(when);
  if (locked) return locked;
  const created = await prisma.accountTransfer.create({
    data: { ...rest, date: when, createdById: session!.user.id },
  });
  await syncLedger([{ type: 'TRANSFER', id: created.id }]);
  const transfer = await prisma.accountTransfer.findUnique({
    where: { id: created.id },
    include: { fromAccount: true, toAccount: true },
  });
  return NextResponse.json(transfer, { status: 201 });
}
