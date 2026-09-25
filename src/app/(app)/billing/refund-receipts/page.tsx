import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { formatMoney } from '@/lib/money';
import { formatDate } from '@/lib/format-date';

export default async function RefundReceiptsPage() {
  const [refunds, settings] = await Promise.all([
    prisma.refundReceipt.findMany({ include: { customer: true }, orderBy: { refundDate: 'desc' } }),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
  ]);
  const currency = settings?.currencyCode ?? 'SCR';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Refund Receipts</h1>
          <p className="text-sm text-slate-500">Money refunded to a customer.</p>
        </div>
        <Link href="/billing/refund-receipts/new" className="btn-primary">
          + New Refund Receipt
        </Link>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Refund #</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {refunds.map((r) => (
              <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-ink-900">{r.refundNumber}</td>
                <td className="px-4 py-3 text-slate-500">{r.customer.displayName}</td>
                <td className="px-4 py-3 text-slate-500">{formatDate(r.refundDate)}</td>
                <td className="px-4 py-3 text-slate-500">{r.method.replace('_', ' ')}</td>
                <td className="px-4 py-3 text-slate-500">{r.reason ?? '—'}</td>
                <td className="px-4 py-3 text-right font-medium">{formatMoney(r.total.toString(), currency)}</td>
              </tr>
            ))}
            {refunds.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  No refund receipts yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
