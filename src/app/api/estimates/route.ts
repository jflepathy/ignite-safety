import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { nextDocumentNumber } from '@/lib/numbering';
import { computeDocumentTotals } from '@/lib/money';
import { z } from 'zod';

export async function GET() {
  const { error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;
  const estimates = await prisma.estimate.findMany({
    where: { deletedAt: null },
    include: { customer: true, lineItems: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return NextResponse.json(estimates);
}

const LineItemSchema = z.object({
  shopItemId: z.string().optional().nullable(),
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  discountPercent: z.number().min(0).max(100).default(0),
  taxRateId: z.string().optional().nullable(),
  taxRatePercent: z.number().min(0).max(100).default(0),
});

const CreateSchema = z.object({
  customerId: z.string().min(1),
  expiryDate: z.string().optional(),
  globalDiscountPercent: z.number().min(0).max(100).default(0),
  notes: z.string().optional(),
  lineItems: z.array(LineItemSchema).min(1),
});

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;
  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  const totals = computeDocumentTotals(data.lineItems, data.globalDiscountPercent);
  const estimateNumber = await nextDocumentNumber('estimateNextSeq', 'estimatePrefix');

  const estimate = await prisma.estimate.create({
    data: {
      estimateNumber,
      customerId: data.customerId,
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
      globalDiscountPercent: data.globalDiscountPercent,
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      taxTotal: totals.taxTotal,
      total: totals.total,
      notes: data.notes,
      createdById: session!.user.id,
      lineItems: {
        create: data.lineItems.map((li, idx) => ({
          shopItemId: li.shopItemId || null,
          description: li.description,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          discountPercent: li.discountPercent,
          taxRateId: li.taxRateId || null,
          lineTotal: totals.lines[idx].lineTotal,
          sortOrder: idx,
        })),
      },
    },
    include: { lineItems: true, customer: true },
  });

  return NextResponse.json(estimate, { status: 201 });
}
