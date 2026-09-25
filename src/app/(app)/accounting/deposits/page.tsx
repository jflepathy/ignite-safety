import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { formatMoney } from '@/lib/money';
import { formatDate } from '@/lib/format-date';

export default async function DepositsPage() {
  const [deposits, settings] = await Promise.all([
    prisma.deposit.findMany({ include: { bankAccount: true }, orderBy: { date: 'desc' } }),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
  ]);
  const currency = settings?.currencyCode ?? 'SCR';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Bank Deposits</h1>
          <p className="text-sm text-slate-500">Money deposited into a bank account.</p>
        </div>
        <Link href="/accounting/deposits/new" className="btn-primary">
          + New Deposit
        </Link>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Bank Account</th>
              <th className="px-4 py-3">Memo</th>
              <th className="px-4 py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {deposits.map((d) => (
              <tr key={d.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-500">{formatDate(d.date)}</td>
                <td className="px-4 py-3 font-medium text-ink-900">{d.bankAccount.name}</td>
                <td className="px-4 py-3 text-slate-500">{d.memo ?? '—'}</td>
                <td className="px-4 py-3 text-right font-medium text-emerald-600">{formatMoney(d.amount.toString(), currency)}</td>
              </tr>
            ))}
            {deposits.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-slate-400">
                  No deposits yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
