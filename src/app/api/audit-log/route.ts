import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';

export async function GET() {
  const { error } = await requireRole('ADMIN');
  if (error) return error;
  const logs = await prisma.auditLog.findMany({
    include: { user: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return NextResponse.json(logs);
}
