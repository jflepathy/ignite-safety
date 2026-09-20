import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;
  const body = await req.json();
  const allowed = ['status', 'notes'];
  const data: Record<string, unknown> = {};
  for (const k of allowed) if (k in body) data[k] = body[k];
  const lead = await prisma.lead.update({ where: { id: params.id }, data });
  return NextResponse.json(lead);
}
