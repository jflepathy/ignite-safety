import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireRole('ADMIN');
  if (error) return error;
  const body = await req.json();
  const item = await prisma.shopItem.update({ where: { id: params.id }, data: body });
  return NextResponse.json(item);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireRole('ADMIN');
  if (error) return error;
  await prisma.shopItem.update({ where: { id: params.id }, data: { active: false } });
  return NextResponse.json({ ok: true });
}
