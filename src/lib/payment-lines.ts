import { formatDate } from '@/lib/format-date';

export type DocumentPayment = { date: string; method: string; reference: string | null; amount: string };

const METHOD_LABEL: Record<string, string> = {
  CASH: 'Cash',
  CARD: 'Card',
  BANK_TRANSFER: 'Bank transfer',
  CHEQUE: 'Cheque',
  OTHER: 'Other',
};

/**
 * Payments to print under the totals of an invoice, oldest first. A payment a
 * technician submitted as a cheque / transfer photo that is still awaiting
 * review (or was flagged as a mismatch) is not counted toward the invoice, so
 * it is not listed either.
 */
export function paymentLinesForDocument(
  payments: { paidAt: Date; method: string; reference: string | null; amount: { toString(): string }; verificationStatus?: string | null }[]
): DocumentPayment[] {
  return [...payments]
    .filter((p) => p.verificationStatus !== 'PENDING_REVIEW' && p.verificationStatus !== 'MISMATCH')
    .sort((a, b) => a.paidAt.getTime() - b.paidAt.getTime())
    .map((p) => ({
      date: formatDate(p.paidAt),
      method: METHOD_LABEL[p.method] ?? p.method,
      reference: p.reference,
      amount: p.amount.toString(),
    }));
}
