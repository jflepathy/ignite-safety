import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { formatMoney } from '@/lib/money';

export default async function TransfersPage() {
  const [transfers, settings] = await Promise.all([
    prisma.accountTransfer.findMany({ include: { fromAccount: true, toAccount: true }, orderBy: { date: 'desc' } }),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
  ]);
  const currency = settings?.currencyCode ?? 'SCR';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Transfers</h1>
          <p className="text-sm text-slate-500">Money moved between accounts.</p>
        </div>
        <Link href="/accounting/transfers/new" className="btn-primary">
          + New Transfer
        </Link>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">From</th>
              <th className="px-4 py-3">To</th>
              <th className="px-4 py-3">Memo</th>
              <th className="px-4 py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {transfers.map((t) => (
              <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-500">{t.date.toLocaleDateString()}</td>
                <td className="px-4 py-3 font-medium text-ink-900">{t.fromAccount.name}</td>
                <td className="px-4 py-3 font-medium text-ink-900">{t.toAccount.name}</td>
                <td className="px-4 py-3 text-slate-500">{t.memo ?? '—'}</td>
                <td className="px-4 py-3 text-right font-medium">{formatMoney(t.amount.toString(), currency)}</td>
              </tr>
            ))}
            {transfers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                  No transfers yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
