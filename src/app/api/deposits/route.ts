import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { z } from 'zod';

export async function GET() {
  const { error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;
  const deposits = await prisma.deposit.findMany({ include: { bankAccount: true }, orderBy: { date: 'desc' } });
  return NextResponse.json(deposits);
}

const CreateSchema = z.object({
  bankAccountId: z.string().min(1),
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
  const { date, ...rest } = parsed.data;

  const deposit = await prisma.$transaction(async (tx) => {
    const d = await tx.deposit.create({
      data: { ...rest, date: date ? new Date(date) : new Date(), createdById: session!.user.id },
    });
    await tx.bankAccount.update({
      where: { id: rest.bankAccountId },
      data: { currentBalance: { increment: rest.amount } },
    });
    return d;
  });

  return NextResponse.json(deposit, { status: 201 });
}
