import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { z } from 'zod';
import { syncLedger } from '@/lib/ledger';
import { closedPeriodResponse } from '@/lib/period-lock';
import { recomputeInvoiceBalance } from '@/lib/invoice-balance';

/**
 * Admin tools for a recorded invoice payment (accounting plan, Phase 1):
 *  - PATCH: move it to the right bank / cash account (e.g. a transfer that was
 *    recorded into Petty Cash by mistake), or correct its date / reference.
 *  - DELETE: reverse it (removes the payment, re-opens the invoice balance and
 *    takes it back out of the bank balance via the ledger).
 */
const PatchSchema = z.object({
  bankAccountId: z.string().min(1).optional(),
  paidAt: z.string().optional(),
  reference: z.string().optional().nullable(),
});

async function audit(userId: string, action: string, paymentId: string, metadata: any) {
  try {
    await prisma.auditLog.create({ data: { userId, action, entityType: 'Payment', entityId: paymentId, metadata } });
  } catch {
    /* best effort */
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string; paymentId: string } }) {
  const { session, error } = await requireRole('ADMIN');
  if (error) return error;
  const parsed = PatchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const payment = await prisma.payment.findUnique({ where: { id: params.paymentId } });
  if (!payment || payment.invoiceId !== params.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const newDate = parsed.data.paidAt ? new Date(parsed.data.paidAt) : null;
  const locked = await closedPeriodResponse(payment.paidAt, newDate);
  if (locked) return locked;
  if (parsed.data.bankAccountId) {
    const bank = await prisma.bankAccount.findUnique({ where: { id: parsed.data.bankAccountId } });
    if (!bank) return NextResponse.json({ error: { formErrors: ['That account no longer exists.'] } }, { status: 400 });
  }
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      ...(parsed.data.bankAccountId ? { bankAccountId: parsed.data.bankAccountId } : {}),
      ...(newDate ? { paidAt: newDate } : {}),
      ...(parsed.data.reference !== undefined ? { reference: parsed.data.reference || null } : {}),
    },
  });
  await syncLedger([{ type: 'PAYMENT', id: payment.id }]);
  await audit(session!.user.id, 'PAYMENT_UPDATED', payment.id, {
    from: { bankAccountId: payment.bankAccountId, paidAt: payment.paidAt },
    to: parsed.data,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; paymentId: string } }) {
  const { session, error } = await requireRole('ADMIN');
  if (error) return error;
  const payment = await prisma.payment.findUnique({ where: { id: params.paymentId }, include: { invoice: { select: { invoiceNumber: true } } } });
  if (!payment || payment.invoiceId !== params.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const locked = await closedPeriodResponse(payment.paidAt);
  if (locked) return locked;
  await prisma.payment.delete({ where: { id: payment.id } });
  await recomputeInvoiceBalance(params.id);
  await syncLedger([{ type: 'PAYMENT', id: payment.id }]);
  await audit(session!.user.id, 'PAYMENT_REVERSED', payment.id, {
    invoiceNumber: payment.invoice.invoiceNumber,
    amount: payment.amount.toString(),
    method: payment.method,
    paidAt: payment.paidAt,
    bankAccountId: payment.bankAccountId,
  });
  return NextResponse.json({ ok: true });
}
