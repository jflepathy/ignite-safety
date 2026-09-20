import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { nextDocumentNumber } from '@/lib/numbering';
import { z } from 'zod';

export async function GET() {
  const { error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;
  const entries = await prisma.journalEntry.findMany({
    include: { lines: { include: { account: true } } },
    orderBy: { date: 'desc' },
  });
  return NextResponse.json(entries);
}

const LineSchema = z.object({
  accountId: z.string().min(1),
  debit: z.number().nonnegative().default(0),
  credit: z.number().nonnegative().default(0),
  description: z.string().optional(),
});

const CreateSchema = z.object({
  memo: z.string().optional(),
  date: z.string().optional(),
  lines: z.array(LineSchema).min(2),
});

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;
  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  const totalDebit = Math.round(data.lines.reduce((s, l) => s + l.debit, 0) * 100) / 100;
  const totalCredit = Math.round(data.lines.reduce((s, l) => s + l.credit, 0) * 100) / 100;
  if (totalDebit !== totalCredit) {
    return NextResponse.json(
      { error: `Journal entry does not balance: debits ${totalDebit} ≠ credits ${totalCredit}` },
      { status: 400 }
    );
  }

  const entryNumber = await nextDocumentNumber('journalEntryNextSeq', 'journalEntryPrefix');

  const entry = await prisma.journalEntry.create({
    data: {
      entryNumber,
      memo: data.memo,
      date: data.date ? new Date(data.date) : new Date(),
      createdById: session!.user.id,
      lines: { create: data.lines },
    },
    include: { lines: { include: { account: true } } },
  });

  return NextResponse.json(entry, { status: 201 });
}
