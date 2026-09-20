import { prisma } from '@/lib/prisma';
import ReceivePaymentClient from '@/components/billing/receive-payment-client';

export default async function ReceivePaymentPage() {
  const [invoices, settings] = await Promise.all([
    prisma.invoice.findMany({
      where: { deletedAt: null, balanceDue: { gt: 0 }, status: { notIn: ['DRAFT', 'VOID'] } },
      include: { customer: true },
      orderBy: { dueDate: 'asc' },
    }),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">Receive Payment</h1>
        <p className="text-sm text-slate-500">Apply a payment against an open invoice.</p>
      </div>
      <ReceivePaymentClient
        invoices={invoices.map((i) => ({
          id: i.id,
          invoiceNumber: i.invoiceNumber,
          customerName: i.customer.displayName,
          total: Number(i.total),
          balanceDue: Number(i.balanceDue),
        }))}
        currency={settings?.currencyCode ?? 'SCR'}
      />
    </div>
  );
}
