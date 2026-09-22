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
  // A line item with no shop item picked and no description typed is an
  // untouched blank row (most commonly the auto-added line beneath a
  // just-picked item) — drop it before validation instead of failing the
  // whole save on "String must contain at least 1 character(s)".
  if (Array.isArray((body as any)?.lineItems)) {
    (body as any).lineItems = (body as any).lineItems.filter(
      (l: any) => (l?.description ?? '').trim() !== '' || !!l?.shopItemId
    );
  }
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  const totals = computeDocumentTotals(data.lineItems, 0);
  const creditNoteNumber = await nextDocumentNumber('creditNoteNextSeq', 'creditNotePrefix');

  // Two-step create — the Neon HTTP adapter can't run the implicit
  // transaction a nested relational `create` normally needs (see the same
  // note in src/app/api/invoices/route.ts).
  const createdNote = await prisma.creditNote.create({
    data: {
      creditNoteNumber,
      customerId: data.customerId,
      invoiceId: data.invoiceId || null,
      status: 'ISSUED',
      reason: data.reason,
      subtotal: totals.subtotal,
      taxTotal: totals.taxTotal,
      total: totals.total,
    },
  });

  // createMany() also requires a transaction under the Neon HTTP adapter
  // (confirmed by direct testing — not just nested `create`), so rows go
  // in one at a time.
  for (let idx = 0; idx < data.lineItems.length; idx++) {
    const li = data.lineItems[idx];
    await prisma.creditNoteLineItem.create({
      data: {
        creditNoteId: createdNote.id,
        shopItemId: li.shopItemId || null,
        description: li.description,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
        taxRateId: li.taxRateId || null,
        lineTotal: totals.lines[idx]?.lineTotal ?? li.quantity * li.unitPrice,
      },
    });
  }

  const note = await prisma.creditNote.findUnique({
    where: { id: createdNote.id },
    include: { lineItems: true, customer: true },
  });

  return NextResponse.json(note ?? createdNote, { status: 201 });
}
