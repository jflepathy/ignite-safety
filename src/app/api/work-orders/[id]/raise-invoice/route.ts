import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { isStaleAssignment } from '@/lib/work-order-status';
import { nextDocumentNumber } from '@/lib/numbering';
import { computeDocumentTotals } from '@/lib/money';
import { buildDraftInvoiceLines, type ServiceLine } from '@/lib/incentives';

// The technician billing-bridge's "Raise Invoice" / "Receiving Payment"
// entry point (Session 16). Builds a DRAFT invoice straight from the
// completed Work Order's serviceLines using the same Incentive Rates
// catalog mapping the desktop "Convert to Draft Invoice" flow uses — kept
// as its own endpoint (rather than reusing POST /api/invoices) because it
// needs to be callable by a TECHNICIAN scoped to their own job, with no
// line-item form to fill in first.
//
// Idempotent: if the Work Order already has a linked invoice (e.g. the
// technician re-opens the bridge after already raising one), that same
// invoice is returned rather than creating a second one.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireRole('ADMIN', 'TECHNICIAN');
  if (error) return error;

  const wo = await prisma.workOrder.findUnique({ where: { id: params.id } });
  if (!wo) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (session!.user.role === 'TECHNICIAN' && wo.assignedTechnicianId !== null && wo.assignedTechnicianId !== session!.user.id && !isStaleAssignment(wo)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (wo.invoiceId) {
    const existing = await prisma.invoice.findUnique({ where: { id: wo.invoiceId }, include: { lineItems: true, customer: true } });
    if (existing) return NextResponse.json(existing);
  }

  const serviceLines = (wo.serviceLines as unknown as ServiceLine[]) ?? [];
  if (serviceLines.length === 0) {
    return NextResponse.json({ error: { formErrors: ['This job has no recorded services to bill yet.'] } }, { status: 400 });
  }

  const [shopItems, incentiveRates] = await Promise.all([
    prisma.shopItem.findMany(),
    prisma.incentiveRate.findMany(),
  ]);
  const shopItemsById = new Map(shopItems.map((s) => [s.id, { id: s.id, sku: s.sku, name: s.name, unitPrice: Number(s.unitPrice), taxable: s.taxable }]));
  const ratesByKey = new Map(
    incentiveRates.map((r) => [
      r.key,
      {
        key: r.key,
        label: r.label,
        shopItemId: r.shopItemId,
        fractionOverride: r.fractionOverride != null ? Number(r.fractionOverride) : null,
        flatAmount: r.flatAmount != null ? Number(r.flatAmount) : null,
        bundledShopItemId: r.bundledShopItemId,
        bundledQuantityPerUnit: Number(r.bundledQuantityPerUnit),
        active: r.active,
      },
    ])
  );
  const builtLines = buildDraftInvoiceLines(serviceLines, ratesByKey, shopItemsById);

  const totals = computeDocumentTotals(
    builtLines.map((l) => ({ quantity: l.quantity, unitPrice: l.unitPrice, discountPercent: 0, taxRatePercent: 0 })),
    0,
    false
  );

  const invoiceNumber = await nextDocumentNumber('invoiceNextSeq', 'invoicePrefix');
  const shareToken = randomBytes(16).toString('hex');

  // Split create + link, not a nested relation — see the note in
  // src/app/api/invoices/route.ts about the Neon HTTP adapter's lack of
  // implicit-transaction support.
  const createdInvoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      customerId: wo.customerId,
      status: 'DRAFT',
      issueDate: new Date(),
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      taxTotal: totals.taxTotal,
      total: totals.total,
      balanceDue: totals.total,
      notes: `Raised from the technician app for Work Order ${wo.woNumber}.`,
      shareToken,
      createdById: session!.user.id,
    },
  });

  await prisma.workOrder.update({
    where: { id: params.id },
    data: { invoiceId: createdInvoice.id, invoiceNumberIfIssued: invoiceNumber },
  });

  for (let idx = 0; idx < builtLines.length; idx++) {
    const l = builtLines[idx];
    await prisma.invoiceLineItem.create({
      data: {
        invoiceId: createdInvoice.id,
        shopItemId: l.shopItemId,
        description: l.needsPricing ? `${l.description} (price to be confirmed by office)` : l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discountPercent: 0,
        lineTotal: totals.lines[idx].lineTotal,
        sortOrder: idx,
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      userId: session!.user.id,
      action: 'INVOICE_CREATED',
      entityType: 'Invoice',
      entityId: createdInvoice.id,
      metadata: { invoiceNumber: createdInvoice.invoiceNumber, total: totals.total, source: 'technician-bridge', workOrderId: wo.id },
    },
  });

  const invoice = await prisma.invoice.findUnique({
    where: { id: createdInvoice.id },
    include: { lineItems: true, customer: true },
  });
  return NextResponse.json(invoice ?? createdInvoice, { status: 201 });
}
