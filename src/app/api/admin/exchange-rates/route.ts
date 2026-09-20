import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { z } from 'zod';

export async function GET() {
  const { error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;
  const [rates, settings] = await Promise.all([
    prisma.exchangeRate.findMany({ orderBy: { currencyCode: 'asc' } }),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
  ]);
  return NextResponse.json({
    rates,
    baseCurrency: settings?.baseCurrency ?? 'SCR',
    fxAutoUpdateEnabled: settings?.fxAutoUpdateEnabled ?? true,
    fxRateLockEnabled: settings?.fxRateLockEnabled ?? false,
    fxLastFetchedAt: settings?.fxLastFetchedAt ?? null,
  });
}

const UpsertSchema = z.object({
  currencyCode: z.string().min(3).max(3),
  rateToBase: z.number().positive(),
  locked: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const { error } = await requireRole('ADMIN');
  if (error) return error;
  const body = await req.json();
  const parsed = UpsertSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { currencyCode, rateToBase, locked } = parsed.data;

  const rate = await prisma.exchangeRate.upsert({
    where: { currencyCode: currencyCode.toUpperCase() },
    create: { currencyCode: currencyCode.toUpperCase(), rateToBase, isManualOverride: true, locked: locked ?? false, source: 'manual' },
    update: { rateToBase, isManualOverride: true, locked: locked ?? undefined, source: 'manual' },
  });
  return NextResponse.json(rate);
}
