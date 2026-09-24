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
    // Session 22, round 10 — was `updateMany`, discovered while building
    // Transaction Reclassify that updateMany() itself (not just
    // $transaction()/upsert()) gets wrapped in an implicit transaction by
    // this Prisma version's query engine, which the Neon HTTP adapter
    // can't run ("Transactions are not supported in HTTP mode") — so this
    // was silently 500ing every time a new tax rate was created as the
    // default. Sequential single-row updates avoid it, same fix as the
    // PATCH handler below already used for the same reason.
    const currentDefaults = await prisma.taxRate.findMany({ where: { isDefault: true } });
    for (const tr of currentDefaults) {
      await prisma.taxRate.update({ where: { id: tr.id }, data: { isDefault: false } });
    }
  }
  const rate = await prisma.taxRate.create({ data: parsed.data });
  return NextResponse.json(rate, { status: 201 });
}
