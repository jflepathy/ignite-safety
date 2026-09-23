import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  // ADMIN configures; SALES/TECHNICIAN need read access too — SALES sees
  // it when confirming an auto-populated draft invoice, TECHNICIAN's own
  // Incentive tab computes live totals from these rates client-side-free
  // (the API route there does the computation, but shares this same GET
  // for the admin screen and any future client-side preview).
  const { error } = await requireRole('ADMIN', 'SALES', 'TECHNICIAN');
  if (error) return error;

  const rates = await prisma.incentiveRate.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { shopItem: true, bundledShopItem: true },
  });
  return NextResponse.json(rates);
}

const CreateSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  shopItemId: z.string().optional().nullable(),
  fractionOverride: z.number().min(0).max(1).optional().nullable(),
  flatAmount: z.number().min(0).optional().nullable(),
  bundledShopItemId: z.string().optional().nullable(),
  bundledQuantityPerUnit: z.number().min(0).default(1),
  active: z.boolean().default(true),
  sortOrder: z.number().default(0),
});

export async function POST(req: NextRequest) {
  const { error } = await requireRole('ADMIN');
  if (error) return error;

  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  const existing = await prisma.incentiveRate.findUnique({ where: { key: data.key } });
  if (existing) {
    return NextResponse.json({ error: { formErrors: ['That key already has a rate configured.'] } }, { status: 400 });
  }

  const rate = await prisma.incentiveRate.create({
    data: {
      key: data.key,
      label: data.label,
      shopItemId: data.shopItemId || null,
      fractionOverride: data.fractionOverride ?? null,
      flatAmount: data.flatAmount ?? null,
      bundledShopItemId: data.bundledShopItemId || null,
      bundledQuantityPerUnit: data.bundledQuantityPerUnit,
      active: data.active,
      sortOrder: data.sortOrder,
    },
  });
  return NextResponse.json(rate, { status: 201 });
}
