import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { nextDocumentNumber } from '@/lib/numbering';
import { computeDocumentTotals } from '@/lib/money';
import { z } from 'zod';

export async function GET() {
  const { error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;
  const notes = await prisma.creditNote.findMany({
    include: { customer: true, lineItems: true, invoice: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return NextResponse.json(notes);
}

const LineItemSchema = z.object({
  shopItemId: z.string().optional().nullable(),
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  taxRateId: z.string().optional().nullable(),
  taxRatePercent: z.number().min(0).max(100).default(0),
});

const CreateSchema = z.object({
  customerId: z.string().min(1),
  invoiceId: z.string().optional().nullable(),
  reason: z.string().optional(),
  lineItems: z.array(LineItemSchema).min(1),
});

export async function POST(req: NextRequest) {
  const { error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;
  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  const totals = computeDocumentTotals(data.lineItems, 0);
  const creditNoteNumber = await nextDocumentNumber('creditNoteNextSeq', 'creditNotePrefix');

  const note = await prisma.creditNote.create({
    data: {
      creditNoteNumber,
      customerId: data.customerId,
      invoiceId: data.invoiceId || null,
      status: 'ISSUED',
      reason: data.reason,
      subtotal: totals.subtotal,
      taxTotal: totals.taxTotal,
      total: totals.total,
      lineItems: {
        create: data.lineItems.map((li) => ({
          shopItemId: li.shopItemId || null,
          description: li.description,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          taxRateId: li.taxRateId || null,
          lineTotal:
            totals.lines[data.lineItems.indexOf(li)]?.lineTotal ?? li.quantity * li.unitPrice,
        })),
      },
    },
    include: { lineItems: true, customer: true },
  });

  return NextResponse.json(note, { status: 201 });
}
