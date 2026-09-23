import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { z } from 'zod';

const UpdateSchema = z.object({
  label: z.string().min(1).optional(),
  shopItemId: z.string().optional().nullable(),
  fractionOverride: z.number().min(0).max(1).optional().nullable(),
  flatAmount: z.number().min(0).optional().nullable(),
  bundledShopItemId: z.string().optional().nullable(),
  bundledQuantityPerUnit: z.number().min(0).optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireRole('ADMIN');
  if (error) return error;

  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  const rate = await prisma.incentiveRate.update({
    where: { id: params.id },
    data: {
      ...data,
      shopItemId: data.shopItemId === undefined ? undefined : data.shopItemId || null,
      bundledShopItemId: data.bundledShopItemId === undefined ? undefined : data.bundledShopItemId || null,
    },
  });
  return NextResponse.json(rate);
}
