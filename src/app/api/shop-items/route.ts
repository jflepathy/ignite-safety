import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { z } from 'zod';

export async function GET() {
  const { error } = await requireRole('ADMIN', 'SALES', 'TECHNICIAN');
  if (error) return error;
  const items = await prisma.shopItem.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
  return NextResponse.json(items);
}

const CreateSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  itemType: z.enum(['INVENTORY', 'NON_INVENTORY', 'SERVICE', 'BUNDLE']).default('NON_INVENTORY'),
  unitPrice: z.number().nonnegative(),
  cost: z.number().nonnegative().optional(),
  taxable: z.boolean().default(true),
  quantityOnHand: z.number().int().optional(),
  reorderPoint: z.number().int().optional(),
  incomeAccountId: z.string().optional(),
  expenseAccountId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const { error } = await requireRole('ADMIN');
  if (error) return error;
  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  // Quantity tracking only means anything for INVENTORY items — Services
  // (and other non-stock types) are explicitly untracked.
  const data = { ...parsed.data };
  if (data.itemType !== 'INVENTORY') {
    data.quantityOnHand = undefined;
    data.reorderPoint = undefined;
  } else if (data.quantityOnHand === undefined) {
    data.quantityOnHand = 0;
  }
  const item = await prisma.shopItem.create({ data });
  return NextResponse.json(item, { status: 201 });
}
