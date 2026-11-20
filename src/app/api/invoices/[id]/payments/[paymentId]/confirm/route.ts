import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { syncLedger } from '@/lib/ledger';
import { closedPeriodResponse } from '@/lib/period-lock';
import { recomputeInvoiceBalance } from '@/lib/invoice-balance';


// Admin manual fallback for a technician-collected cheque/transfer payment
// that's sitting at PENDING_REVIEW (no GEMINI_API_KEY configured yet, or
// the AI pass wasn't confident) or MISMATCH (AI flagged a discrepancy but
// an admin, having looked at the photo themselves, confirms it's actually
// fine) — see /api/invoices/[id]/technician-payment. Confirming here is
// what actually moves the money: bumps the bank account balance and the
// invoice's balanceDue/status, exactly like a normal recorded payment.
export async function POST(req: NextRequest, { params }: { params: { id: string; paymentId: string } }) {
  const { session, error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;

  const payment = await prisma.payment.findUnique({ where: { id: params.paymentId } });
  if (!payment || payment.invoiceId !== params.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (payment.verificationStatus === 'CONFIRMED') {
    return NextResponse.json({ error: { formErrors: ['Already confirmed.'] } }, { status: 400 });
  }
  if (!payment.bankAccountId) {
    return NextResponse.json({ error: { formErrors: ['This payment has no bank account set — cannot confirm.'] } }, { status: 400 });
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: { verificationStatus: 'CONFIRMED', verifiedAt: new Date(), verifiedById: session!.user.id },
  });

  await recomputeInvoiceBalance(params.id);
  await syncLedger([{ type: 'PAYMENT', id: payment.id }]);

  const updated = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: { payments: true, customer: true, lineItems: true },
  });

  return NextResponse.json(updated);
}
