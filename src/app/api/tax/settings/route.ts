import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { z } from 'zod';

const Schema = z.object({ vatFilingFrequency: z.enum(['MONTHLY', 'QUARTERLY']), vatDueDay: z.number().int().min(1).max(31) });

export async function PATCH(req: NextRequest) {
  const { error } = await requireRole('ADMIN');
  if (error) return error;
  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid settings' }, { status: 400 });
  await prisma.appSettings.update({ where: { id: 1 }, data: parsed.data });
  return NextResponse.json({ ok: true });
}
