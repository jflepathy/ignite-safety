import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { computeDocumentTotals } from '@/lib/money';
import { z } from 'zod';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;

  const receipt = await prisma.salesReceipt.findUnique({
    where: { id: params.id },
    include: { customer: true, lineItems: { include: { taxRate: true, shopItem: true } } },
  });
  if (!receipt) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(receipt);
}

const LineItemSchema = z.object({
  shopItemId: z.string().optional().nullable(),
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  taxRateId: z.string().optional().nullable(),
  taxRatePercent: z.number().min(0).max(100).default(0),
});

const UpdateSchema = z.object({
  customerId: z.string().min(1).optional(),
  paymentMethod: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'OTHER']).optional(),
  notes: z.string().optional(),
  lineItems: z.array(LineItemSchema).min(1).optional(),
});

// A Sales Receipt has no draft/sent status (it records an already-completed,
// fully-paid sale), so editing only ever changes its own fields in place —
// there is no separate "save & send" step like Invoice has.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;

  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  const existing = await prisma.salesReceipt.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let totalsPatch = {};
  if (data.lineItems) {
    const totals = computeDocumentTotals(
      data.lineItems.map((li) => ({
        quantity: li.quantity,
        unitPrice: li.unitPrice,
        discountPercent: 0,
        taxRatePercent: li.taxRatePercent,
      })),
      0
    );
    // Sequential writes, not createMany()/a transaction -- the Neon HTTP
    // driver adapter can't run either (see src/app/api/invoices/route.ts).
    await prisma.salesReceiptLineItem.deleteMany({ where: { salesReceiptId: params.id } });
    for (let idx = 0; idx < data.lineItems.length; idx++) {
      const li = data.lineItems[idx];
      await prisma.salesReceiptLineItem.create({
        data: {
          salesReceiptId: params.id,
          shopItemId: li.shopItemId || null,
          description: li.description,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          taxRateId: li.taxRateId || null,
          lineTotal: totals.lines[idx].lineTotal,
        },
      });
    }
    totalsPatch = {
      subtotal: totals.subtotal,
      taxTotal: totals.taxTotal,
      total: totals.total,
    };
  }

  await prisma.salesReceipt.update({
    where: { id: params.id },
    data: {
      ...(data.customerId ? { customerId: data.customerId } : {}),
      ...(data.paymentMethod ? { paymentMethod: data.paymentMethod } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
      ...totalsPatch,
    },
  });
  const receipt = await prisma.salesReceipt.findUnique({
    where: { id: params.id },
    include: { lineItems: true, customer: true },
  });

  return NextResponse.json(receipt);
}
