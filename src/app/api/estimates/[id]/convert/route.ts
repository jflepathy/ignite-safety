import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { nextDocumentNumber } from '@/lib/numbering';

// Converts an accepted Estimate/Quote into a DRAFT Invoice with identical
// line items, preserving the QuickBooks-style "manual" billing flow: the
// resulting invoice still lands as a draft for a human to review and send.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;

  const estimate = await prisma.estimate.findUnique({
    where: { id: params.id },
    include: { lineItems: true },
  });
  if (!estimate) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (estimate.status === 'CONVERTED') {
    return NextResponse.json({ error: 'Already converted' }, { status: 409 });
  }

  const invoiceNumber = await nextDocumentNumber('invoiceNextSeq', 'invoicePrefix');

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      customerId: estimate.customerId,
      status: 'DRAFT',
      globalDiscountPercent: estimate.globalDiscountPercent,
      subtotal: estimate.subtotal,
      discountTotal: estimate.discountTotal,
      taxTotal: estimate.taxTotal,
      total: estimate.total,
      balanceDue: estimate.total,
      notes: `Converted from estimate ${estimate.estimateNumber}`,
      createdById: session!.user.id,
      lineItems: {
        create: estimate.lineItems.map((li) => ({
          shopItemId: li.shopItemId,
          description: li.description,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          discountPercent: li.discountPercent,
          taxRateId: li.taxRateId,
          lineTotal: li.lineTotal,
          sortOrder: li.sortOrder,
        })),
      },
    },
    include: { lineItems: true, customer: true },
  });

  await prisma.estimate.update({ where: { id: params.id }, data: { status: 'CONVERTED' } });

  return NextResponse.json(invoice, { status: 201 });
}
