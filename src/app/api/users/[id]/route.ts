import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireRole('ADMIN');
  if (error) return error;
  const body = await req.json();
  const allowed = ['name', 'role', 'active', 'phone'];
  const data: Record<string, unknown> = {};
  for (const key of allowed) if (key in body) data[key] = body[key];
  const user = await prisma.user.update({
    where: { id: params.id },
    data,
    select: { id: true, name: true, email: true, role: true, active: true },
  });
  return NextResponse.json(user);
}
