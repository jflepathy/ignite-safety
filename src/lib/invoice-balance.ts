import { prisma } from '@/lib/prisma';

/**
 * Recomputes an invoice's amountPaid / creditApplied / balanceDue / status from
 * its payments and the credit notes applied to it. Technician cheque/transfer
 * payments still awaiting review (or flagged as a mismatch) don't count.
 */
export async function recomputeInvoiceBalance(invoiceId: string) {
  const inv = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { payments: true, creditNotes: { select: { total: true, status: true } } },
  });
  if (!inv) return null;
  const paid = inv.payments
    .filter((p) => p.verificationStatus !== 'PENDING_REVIEW' && p.verificationStatus !== 'MISMATCH')
    .reduce((s, p) => s + Number(p.amount), 0);
  const total = Number(inv.total);
  const credits = inv.creditNotes
    .filter((c) => c.status === 'ISSUED' || c.status === 'APPLIED')
    .reduce((s, c) => s + Number(c.total), 0);
  const creditApplied = Math.min(credits, Math.max(total - paid, 0));
  const balanceDue = Math.max(Math.round((total - paid - creditApplied) * 100) / 100, 0);

  let status = inv.status;
  if (inv.status !== 'DRAFT' && inv.status !== 'VOID') {
    if (balanceDue <= 0) status = 'PAID';
    else if (paid > 0 || creditApplied > 0) status = 'PARTIAL';
    else if (inv.dueDate && inv.dueDate < new Date()) status = 'OVERDUE';
    else status = 'SENT';
  }
  await prisma.invoice.update({ where: { id: invoiceId }, data: { amountPaid: paid, creditApplied, balanceDue, status } });
  return { paid, creditApplied, balanceDue, status };
}
