import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { canTechnicianAccess } from '@/lib/work-order-status';
import { verifyPaymentPhoto } from '@/lib/payment-verification';
import { z } from 'zod';

// The technician billing-bridge's "Receiving Payment" step (Session 16) —
// deliberately separate from POST /api/invoices/[id]/payments (which stays
// ADMIN/SALES-only and requires picking a bank account from the full
// list). This route is reachable by a TECHNICIAN, but only for an invoice
// linked to a Work Order assigned to them, and always deposits into the
// admin-configured AppSettings.technicianCollectionsBankAccountId rather
// than letting them pick an account.
//
// Cash is CONFIRMED immediately (the technician physically has it in
// hand). Cheque/Transfer require a photo and start PENDING_REVIEW; if a
// GEMINI_API_KEY is configured, an AI pass runs synchronously and can
// confirm (or flag MISMATCH) on the spot — otherwise it's left for an
// admin to confirm by hand from the "Payments awaiting review" card on
// the Billing page (or the invoice's own Payments panel).
const Schema = z.object({
  amount: z.number().positive(),
  method: z.enum(['CASH', 'CHEQUE', 'BANK_TRANSFER']),
  photoDataUrl: z.string().optional(), // required for CHEQUE / BANK_TRANSFER
  notes: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireRole('ADMIN', 'TECHNICIAN');
  if (error) return error;

  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  if (data.method !== 'CASH' && !data.photoDataUrl) {
    return NextResponse.json({ error: { formErrors: ['A photo of the cheque / transfer confirmation is required.'] } }, { status: 400 });
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: { payments: true, workOrder: { include: { additionalTechnicians: true } }, customer: true },
  });
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (session!.user.role === 'TECHNICIAN') {
    const wo = invoice.workOrder;
    if (!wo || !canTechnicianAccess(wo, wo.additionalTechnicians.map((t) => t.technicianId), session!.user.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const settings = await prisma.appSettings.findUnique({ where: { id: 1 } });
  const bankAccountId = settings?.technicianCollectionsBankAccountId;
  if (!bankAccountId) {
    return NextResponse.json(
      { error: { formErrors: ['No collections account is configured yet — ask an admin to set one under Team > Incentive Rates.'] } },
      { status: 400 }
    );
  }
  const bankAccount = await prisma.bankAccount.findUnique({ where: { id: bankAccountId } });
  if (!bankAccount) {
    return NextResponse.json({ error: { formErrors: ['The configured collections account no longer exists — ask an admin to fix this under Team > Incentive Rates.'] } }, { status: 400 });
  }

  let verificationStatus: 'NONE' | 'PENDING_REVIEW' | 'CONFIRMED' | 'MISMATCH' = 'NONE';
  let proofNotes: string | undefined;
  let verifiedAt: Date | undefined;

  if (data.method === 'CASH') {
    verificationStatus = 'CONFIRMED';
    verifiedAt = new Date();
  } else {
    // Cheque / Bank Transfer — attempt the AI pass; fall back to manual review.
    const result = await verifyPaymentPhoto({
      method: data.method,
      photoDataUrl: data.photoDataUrl!,
      expectedAmount: data.amount,
      currency: settings?.currencyCode ?? 'SCR',
      payeeName: settings?.legalName || settings?.companyName || 'the company',
    });
    if (!result.available) {
      verificationStatus = 'PENDING_REVIEW';
      proofNotes = 'Awaiting admin review (AI verification not yet configured — see the "Payments awaiting review" card on Billing).';
    } else if (result.matches && result.confidence !== 'low') {
      verificationStatus = 'CONFIRMED';
      verifiedAt = new Date();
      proofNotes = result.notes;
    } else if (!result.matches) {
      verificationStatus = 'MISMATCH';
      proofNotes = result.notes;
    } else {
      verificationStatus = 'PENDING_REVIEW';
      proofNotes = result.notes;
    }
  }

  const payment = await prisma.payment.create({
    data: {
      invoiceId: invoice.id,
      amount: data.amount,
      method: data.method,
      bankAccountId,
      notes: data.notes,
      recordedById: session!.user.id,
      verificationStatus,
      proofPhotoUrl: data.method === 'CASH' ? null : data.photoDataUrl,
      proofNotes,
      verifiedAt,
      // verifiedById stays null here — nothing on this path is confirmed by
      // a person; it's set only if/when an admin manually confirms a
      // PENDING_REVIEW/MISMATCH payment from the invoice's Payments panel.
    },
  });

  // A MISMATCH-flagged payment is recorded for the admin to see, but does
  // NOT count toward the invoice's balance yet — only CONFIRMED payments
  // move money. PENDING_REVIEW also doesn't count until an admin (or a
  // later AI pass) confirms it.
  const countsNow = verificationStatus === 'CONFIRMED';
  let updatedInvoice = invoice;
  if (countsNow) {
    await prisma.bankAccount.update({ where: { id: bankAccountId }, data: { currentBalance: { increment: data.amount } } });
    // Every prior payment counts unless it's still awaiting/failed proof
    // review (PENDING_REVIEW / MISMATCH) — a normal office-recorded
    // payment (verificationStatus: NONE) always counts, same as before
    // this feature existed.
    const totalPaid = [...invoice.payments, payment]
      .filter((p) => p.verificationStatus !== 'PENDING_REVIEW' && p.verificationStatus !== 'MISMATCH')
      .reduce((s, p) => s + Number(p.amount), 0);
    const total = Number(invoice.total);
    const balanceDue = Math.max(total - totalPaid, 0);
    let status: 'PARTIAL' | 'PAID' | 'SENT' = invoice.status as any;
    if (balanceDue <= 0) status = 'PAID';
    else if (totalPaid > 0) status = 'PARTIAL';
    await prisma.invoice.update({ where: { id: invoice.id }, data: { amountPaid: totalPaid, balanceDue, status } });
  }
  updatedInvoice = (await prisma.invoice.findUnique({ where: { id: invoice.id }, include: { payments: true, customer: true, lineItems: true } })) as any;

  return NextResponse.json({ payment, invoice: updatedInvoice }, { status: 201 });
}
