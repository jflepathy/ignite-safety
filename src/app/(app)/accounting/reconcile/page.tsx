import { prisma } from '@/lib/prisma';
import { formatMoney } from '@/lib/money';
import { formatDate } from '@/lib/format-date';

// Lite reconciliation view: lists raw bank transactions and their
// reconciled state. A full statement-import + auto-matching engine is a
// clearly-marked "coming soon" item — see README for the tiering notes.
export default async function ReconcilePage() {
  const [bankAccounts, settings] = await Promise.all([
    prisma.bankAccount.findMany({
      include: { transactions: { orderBy: { date: 'desc' }, take: 50 } },
      orderBy: { name: 'asc' },
    }),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
  ]);
  const currency = settings?.currencyCode ?? 'SCR';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">Reconcile</h1>
        <p className="text-sm text-slate-500">
          Bank transactions for each account. Statement import and automatic matching are coming soon — for now, transactions are
          created from deposits and transfers and marked reconciled manually.
        </p>
      </div>

      {bankAccounts.map((acc) => (
        <div key={acc.id} className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <p className="font-medium text-ink-900">{acc.name}</p>
              <p className="text-xs text-slate-500">{acc.accountType}</p>
            </div>
            <p className="text-lg font-semibold text-ink-900">{formatMoney(acc.currentBalance.toString(), currency)}</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Description</th>
                <th className="px-4 py-2 text-right">Amount</th>
                <th className="px-4 py-2">Reconciled</th>
              </tr>
            </thead>
            <tbody>
              {acc.transactions.map((t) => (
                <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-2 text-slate-500">{formatDate(t.date)}</td>
                  <td className="px-4 py-2 text-ink-900">{t.description}</td>
                  <td className={`px-4 py-2 text-right font-medium ${Number(t.amount) < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {formatMoney(t.amount.toString(), currency)}
                  </td>
                  <td className="px-4 py-2 text-slate-500">{t.reconciled ? 'Yes' : 'No'}</td>
                </tr>
              ))}
              {acc.transactions.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                    No transactions yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ))}
      {bankAccounts.length === 0 && <p className="text-sm text-slate-400">No bank accounts set up yet.</p>}
    </div>
  );
}
