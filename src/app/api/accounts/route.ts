import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { z } from 'zod';

export async function GET() {
  const { error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;
  const accounts = await prisma.account.findMany({ orderBy: { code: 'asc' } });
  return NextResponse.json(accounts);
}

const CreateSchema = z.object({
  code: z.string().optional(),
  name: z.string().min(1),
  type: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE']),
  subtype: z.string().optional(),
  description: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const { error } = await requireRole('ADMIN');
  if (error) return error;
  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const account = await prisma.account.create({ data: parsed.data });
  return NextResponse.json(account, { status: 201 });
}
