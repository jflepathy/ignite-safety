import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { nextDocumentNumber } from '@/lib/numbering';
import { computeDocumentTotals } from '@/lib/money';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  const { error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;

  const status = req.nextUrl.searchParams.get('status') || undefined;
  const invoices = await prisma.invoice.findMany({
    where: { deletedAt: null, ...(status ? { status: status as any } : {}) },
    include: { customer: true, payments: true, workOrder: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return NextResponse.json(invoices);
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

const CreateInvoiceSchema = z.object({
  customerId: z.string().min(1),
  workOrderId: z.string().optional().nullable(),
  issueDate: z.string().optional(),
  dueDate: z.string().optional(),
  globalDiscountPercent: z.number().min(0).max(100).default(0),
  terms: z.string().optional(),
  notes: z.string().optional(),
  customerMessage: z.string().optional(),
  taxInclusive: z.boolean().default(false),
  customerPaymentOptions: z.record(z.boolean()).optional(),
  isRecurring: z.boolean().default(false),
  recurringFrequency: z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY']).optional(),
  status: z.enum(['DRAFT', 'SENT']).default('DRAFT'),
  lineItems: z.array(LineItemSchema).min(1),
});

function computeNextRunDate(frequency: string, from: Date): Date {
  const next = new Date(from);
  if (frequency === 'WEEKLY') next.setDate(next.getDate() + 7);
  else if (frequency === 'QUARTERLY') next.setMonth(next.getMonth() + 3);
  else if (frequency === 'ANNUALLY') next.setFullYear(next.getFullYear() + 1);
  else next.setMonth(next.getMonth() + 1);
  return next;
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;

  const body = await req.json();
  const parsed = CreateInvoiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const totals = computeDocumentTotals(
    data.lineItems.map((li) => ({
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      discountPercent: li.discountPercent,
      taxRatePercent: li.taxRatePercent,
    })),
    data.globalDiscountPercent,
    data.taxInclusive
  );

  const invoiceNumber = await nextDocumentNumber('invoiceNextSeq', 'invoicePrefix');
  const shareToken = randomBytes(16).toString('hex');

  // Recurring is opt-in per invoice: when checked, we create a
  // RecurringTemplate snapshotting this invoice's shape. Actually
  // regenerating future invoices on schedule (a background job) is a
  // Tier 3 "coming soon" item — the template is stored and visible so the
  // groundwork is real, but nothing auto-fires yet.
  let recurringTemplateId: string | undefined;
  if (data.isRecurring) {
    const frequency = data.recurringFrequency ?? 'MONTHLY';
    const template = await prisma.recurringTemplate.create({
      data: {
        name: `Recurring — ${invoiceNumber}`,
        documentType: 'INVOICE',
        frequency,
        startDate: data.issueDate ? new Date(data.issueDate) : new Date(),
        nextRunDate: computeNextRunDate(frequency, data.issueDate ? new Date(data.issueDate) : new Date()),
        customerId: data.customerId,
        templateData: {
          globalDiscountPercent: data.globalDiscountPercent,
          taxInclusive: data.taxInclusive,
          terms: data.terms,
          lineItems: data.lineItems,
        },
        createdById: session!.user.id,
      },
    });
    recurringTemplateId = template.id;
  }

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      customerId: data.customerId,
      status: data.status,
      issueDate: data.issueDate ? new Date(data.issueDate) : new Date(),
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      globalDiscountPercent: data.globalDiscountPercent,
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      taxTotal: totals.taxTotal,
      total: totals.total,
      balanceDue: totals.total,
      terms: data.terms,
      notes: data.notes,
      customerMessage: data.customerMessage,
      taxInclusive: data.taxInclusive,
      customerPaymentOptions: data.customerPaymentOptions ?? undefined,
      shareToken,
      isRecurring: data.isRecurring,
      recurringTemplateId,
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
      ...(data.workOrderId
        ? { workOrder: { connect: { id: data.workOrderId } } }
        : {}),
    },
    include: { lineItems: true, customer: true },
  });

  await prisma.auditLog.create({
    data: {
      userId: session!.user.id,
      action: 'INVOICE_CREATED',
      entityType: 'Invoice',
      entityId: invoice.id,
      metadata: { invoiceNumber: invoice.invoiceNumber, total: totals.total },
    },
  });

  return NextResponse.json(invoice, { status: 201 });
}
