import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { z } from 'zod';

export async function GET() {
  const { error } = await requireRole('ADMIN', 'SALES', 'TECHNICIAN');
  if (error) return error;
  const rates = await prisma.taxRate.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
  return NextResponse.json(rates);
}

const CreateSchema = z.object({
  name: z.string().min(1),
  ratePercent: z.number().min(0).max(100),
  isDefault: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  const { error } = await requireRole('ADMIN');
  if (error) return error;
  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  if (parsed.data.isDefault) {
    await prisma.taxRate.updateMany({ data: { isDefault: false }, where: {} });
  }
  const rate = await prisma.taxRate.create({ data: parsed.data });
  return NextResponse.json(rate, { status: 201 });
}
