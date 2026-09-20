import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';

export async function PATCH(req: NextRequest, { params }: { params: { code: string } }) {
  const { error } = await requireRole('ADMIN');
  if (error) return error;
  const body = await req.json();
  const rate = await prisma.exchangeRate.update({
    where: { currencyCode: params.code.toUpperCase() },
    data: { locked: typeof body.locked === 'boolean' ? body.locked : undefined },
  });
  return NextResponse.json(rate);
}

export async function DELETE(_req: NextRequest, { params }: { params: { code: string } }) {
  const { error } = await requireRole('ADMIN');
  if (error) return error;
  await prisma.exchangeRate.delete({ where: { currencyCode: params.code.toUpperCase() } });
  return NextResponse.json({ ok: true });
}
