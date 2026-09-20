import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;
  await prisma.attachment.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
