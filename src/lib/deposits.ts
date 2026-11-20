import { prisma } from '@/lib/prisma';

/**
 * Money received but not yet in a bank / cash account ("Undeposited Funds"):
 * invoice payments and sales receipts saved without a deposit-to account, that
 * haven't been grouped into a Deposit yet.
 */
export type UndepositedItem = {
  kind: 'payment' | 'receipt';
  id: string;
  date: Date;
  label: string;
  customer: string;
  method: string;
  amount: number;
};

function idsFrom(json: unknown): string[] {
  return Array.isArray(json) ? json.filter((x): x is string => typeof x === 'string') : [];
}

export async function depositedIds() {
  const deposits = await prisma.deposit.findMany({ select: { paymentIds: true, receiptIds: true } });
  return {
    payments: new Set(deposits.flatMap((d) => idsFrom(d.paymentIds))),
    receipts: new Set(deposits.flatMap((d) => idsFrom(d.receiptIds))),
  };
}

export async function undepositedItems(): Promise<UndepositedItem[]> {
  const [done, payments, receipts] = await Promise.all([
    depositedIds(),
    prisma.payment.findMany({
      where: { bankAccountId: null, verificationStatus: { in: ['NONE', 'CONFIRMED'] } },
      include: { invoice: { select: { invoiceNumber: true, customer: { select: { displayName: true } } } } },
    }),
    prisma.salesReceipt.findMany({ where: { bankAccountId: null }, include: { customer: { select: { displayName: true } } } }),
  ]);
  const items: UndepositedItem[] = [
    ...payments
      .filter((p) => !done.payments.has(p.id))
      .map((p) => ({
        kind: 'payment' as const,
        id: p.id,
        date: p.paidAt,
        label: `Payment · Invoice ${p.invoice.invoiceNumber}`,
        customer: p.invoice.customer.displayName,
        method: p.method,
        amount: Number(p.amount),
      })),
    ...receipts
      .filter((r) => !done.receipts.has(r.id))
      .map((r) => ({
        kind: 'receipt' as const,
        id: r.id,
        date: r.saleDate,
        label: `Sales receipt ${r.receiptNumber}`,
        customer: r.customer.displayName,
        method: r.paymentMethod,
        amount: Number(r.total),
      })),
  ];
  return items.sort((a, b) => a.date.getTime() - b.date.getTime());
}
