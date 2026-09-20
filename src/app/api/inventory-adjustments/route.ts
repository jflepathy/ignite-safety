import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { z } from 'zod';

export async function GET() {
  const { error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;
  const adjustments = await prisma.inventoryAdjustment.findMany({
    include: { shopItem: true },
    orderBy: { date: 'desc' },
  });
  return NextResponse.json(adjustments);
}

const CreateSchema = z.object({
  shopItemId: z.string().min(1),
  quantityChange: z.number().int(),
  reason: z.string().optional(),
  memo: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;
  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  const adjustment = await prisma.$transaction(async (tx) => {
    const adj = await tx.inventoryAdjustment.create({
      data: { ...data, createdById: session!.user.id },
    });
    await tx.shopItem.update({
      where: { id: data.shopItemId },
      data: { quantityOnHand: { increment: data.quantityChange } },
    });
    return adj;
  });

  return NextResponse.json(adjustment, { status: 201 });
}
