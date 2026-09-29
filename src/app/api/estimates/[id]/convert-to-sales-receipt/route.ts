import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { nextDocumentNumber } from '@/lib/numbering';
import { computeDocumentTotals } from '@/lib/money';
import { createEquipmentForSoldLines } from '@/lib/equipment-from-sale';
import { z } from 'zod';

const BodySchema = z.object({
  paymentMethod: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'OTHER']).default('CASH'),
});

// Session 22, round 15 — the sibling of convert/route.ts (Estimate →
// Invoice), for the equally common case where the customer accepts the
// quote and pays on the spot: convert straight to a fully-paid Sales
// Receipt, with no draft-invoice/AR step in between.
//
// Sales Receipt has no discount concept anywhere in its schema — no
// globalDiscountPercent, no per-line discountPercent, unlike
// Invoice/Estimate which share that shape exactly (which is why the
// Invoice conversion route can just copy every field 1:1). So any
// discount on the source estimate (global or per-line) is folded into
// each line's effective unit price here, and the whole document is
// recomputed from scratch via computeDocumentTotals rather than copied
// verbatim — otherwise a discounted estimate would produce a receipt
// whose printed qty x unit price silently doesn't add up to its own line
// total, with no discount line anywhere on the document to explain why.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const estimate = await prisma.estimate.findUnique({
    where: { id: params.id },
    include: { lineItems: { include: { taxRate: true } } },
  });
  if (!estimate) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (estimate.status === 'CONVERTED') {
    return NextResponse.json({ error: 'This estimate has already been converted.' }, { status: 409 });
  }

  const globalFactor = 1 - Number(estimate.globalDiscountPercent) / 100;
  const foldedLines = estimate.lineItems.map((li) => {
    const itemFactor = 1 - Number(li.discountPercent) / 100;
    return {
      shopItemId: li.shopItemId,
      description: li.description,
      quantity: Number(li.quantity),
      unitPrice: Number(li.unitPrice) * itemFactor * globalFactor,
      taxRateId: li.taxRateId,
      taxRatePercent: li.taxRate ? Number(li.taxRate.ratePercent) : 0,
    };
  });

  const totals = computeDocumentTotals(foldedLines, 0, estimate.taxInclusive);
  const receiptNumber = await nextDocumentNumber('invoiceNextSeq', 'invoicePrefix');

  // Two-step create — the Neon HTTP adapter can't run the implicit
  // transaction a nested relational `create` normally needs (see the same
  // note in src/app/api/invoices/route.ts).
  const createdReceipt = await prisma.salesReceipt.create({
    data: {
      receiptNumber,
      customerId: estimate.customerId,
      paymentMethod: parsed.data.paymentMethod,
      subtotal: totals.subtotal,
      taxTotal: totals.taxTotal,
      total: totals.total,
      notes: `Converted from estimate ${estimate.estimateNumber}`,
      createdById: session!.user.id,
    },
  });

  // createMany() also requires a transaction under the Neon HTTP adapter
  // (confirmed by direct testing — not just nested `create`), so rows go
  // in one at a time.
  for (let idx = 0; idx < foldedLines.length; idx++) {
    const li = foldedLines[idx];
    await prisma.salesReceiptLineItem.create({
      data: {
        salesReceiptId: createdReceipt.id,
        shopItemId: li.shopItemId,
        description: li.description,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
        taxRateId: li.taxRateId,
        lineTotal: totals.lines[idx].lineTotal,
      },
    });
  }

  await prisma.estimate.update({ where: { id: params.id }, data: { status: 'CONVERTED' } });

  // A converted-to-receipt estimate is a real, immediately-paid sale too —
  // see the matching note in api/invoices/route.ts (Session 22, round 14).
  await createEquipmentForSoldLines({
    customerId: estimate.customerId,
    saleDate: createdReceipt.saleDate,
    lines: foldedLines,
  });

  const receipt = await prisma.salesReceipt.findUnique({
    where: { id: createdReceipt.id },
    include: { lineItems: true, customer: true },
  });

  return NextResponse.json(receipt ?? createdReceipt, { status: 201 });
}
