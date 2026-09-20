import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { formatMoney } from '@/lib/money';
import ClickableRow from '@/components/shared/clickable-row';

export default async function SalesReceiptsPage() {
  const [receipts, settings] = await Promise.all([
    prisma.salesReceipt.findMany({ include: { customer: true }, orderBy: { saleDate: 'desc' } }),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
  ]);
  const currency = settings?.currencyCode ?? 'SCR';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Sales Receipts</h1>
          <p className="text-sm text-slate-500">Immediate, fully-paid sales — no outstanding balance.</p>
        </div>
        <Link href="/billing/sales-receipts/new" className="btn-primary">
          + New Sales Receipt
        </Link>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Receipt #</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {receipts.map((r) => (
              <ClickableRow key={r.id} href={`/billing/sales-receipts/${r.id}`}>
                <td className="px-4 py-3 font-medium text-ink-900">{r.receiptNumber}</td>
                <td className="px-4 py-3 text-slate-500">{r.customer.displayName}</td>
                <td className="px-4 py-3 text-slate-500">{r.saleDate.toLocaleDateString()}</td>
                <td className="px-4 py-3 text-slate-500">{r.paymentMethod.replace('_', ' ')}</td>
                <td className="px-4 py-3 text-right font-medium">{formatMoney(r.total.toString(), currency)}</td>
              </ClickableRow>
            ))}
            {receipts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                  No sales receipts yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
