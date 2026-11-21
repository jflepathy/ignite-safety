import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { formatMoney } from '@/lib/money';
import { undepositedItems } from '@/lib/deposits';

export default async function AccountingOverviewPage() {
  const [bankAccounts, settings, undeposited] = await Promise.all([
    prisma.bankAccount.findMany({ orderBy: { name: 'asc' } }),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
    undepositedItems(),
  ]);
  const undepositedTotal = undeposited.reduce((s, i) => s + i.amount, 0);
  const currency = settings?.currencyCode ?? 'SCR';
  // Inter-company accounts track what sister companies owe Ignite Safety (positive)
  // or what Ignite Safety owes them (negative); they are not cash.
  const cashAccounts = bankAccounts.filter((a) => a.accountType !== 'INTERCOMPANY');
  const interAccounts = bankAccounts.filter((a) => a.accountType === 'INTERCOMPANY');
  const totalCash = cashAccounts.reduce((s, a) => s + Number(a.currentBalance), 0);

  const links = [
    { label: 'Financial Reports', href: '/accounting/reports', desc: 'Profit & Loss, Balance Sheet, Trial Balance and cash movement.' },
    { label: 'Chart of Accounts', href: '/accounting/chart-of-accounts', desc: 'Assets, liabilities, equity, income & expense accounts, with balances.' },
    { label: 'Reconcile', href: '/accounting/reconcile', desc: 'Match bank transactions against your books.' },
    { label: 'Bank Deposits', href: '/accounting/deposits', desc: 'Move receipts waiting in Undeposited Funds into the bank.' },
    { label: 'Transfers', href: '/accounting/transfers', desc: 'Move money between accounts.' },
    { label: 'Journal Entries', href: '/accounting/journal-entries', desc: 'Manual double-entry postings.' },
    { label: 'Ledger Tools', href: '/accounting/ledger-tools', desc: 'Health checks, rebuild, and closing the books (admin).' },
    { label: 'Audit Log', href: '/accounting/audit-log', desc: 'Who changed what, and when.' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">Accounting</h1>
        <p className="text-sm text-slate-500">Books, banking and the audit trail.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-4">
          <p className="text-xs uppercase text-slate-500">Total Cash on Hand</p>
          <p className="text-2xl font-semibold text-ink-900">{formatMoney(totalCash, currency)}</p>
          <p className="mt-1 text-xs text-slate-400">{cashAccounts.length} bank / cash account(s)</p>
        </div>
        {cashAccounts.map((b) => (
          <Link key={b.id} href={`/accounting/ledger/${b.accountId}`} className="card p-4 hover:border-brand-300">
            <p className="text-xs uppercase text-slate-500">{b.name}</p>
            <p className="text-2xl font-semibold text-ink-900">{formatMoney(b.currentBalance.toString(), currency)}</p>
          </Link>
        ))}
        <Link href="/accounting/deposits/new" className="card p-4 hover:border-brand-300">
          <p className="text-xs uppercase text-slate-500">Undeposited Funds</p>
          <p className="text-2xl font-semibold text-amber-600">{formatMoney(undepositedTotal, currency)}</p>
          <p className="mt-1 text-xs text-slate-400">{undeposited.length} item(s) waiting to be banked</p>
        </Link>
      </div>

      {interAccounts.length > 0 && (
        <div className="card overflow-x-auto">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-ink-900">Inter-company accounts</p>
            <p className="text-xs text-slate-500">Money moved between Ignite Safety and the sister companies. Use Transfers to record movements.</p>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {interAccounts.map((b) => {
                const bal = Number(b.currentBalance);
                return (
                  <tr key={b.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-2">
                      <Link href={`/accounting/ledger/${b.accountId}`} className="font-medium text-ink-900 hover:text-brand-600 hover:underline">
                        {b.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-slate-500">
                      {bal > 0 ? 'Owes Ignite Safety' : bal < 0 ? 'Ignite Safety owes' : 'Settled'}
                    </td>
                    <td className={`px-4 py-2 text-right font-medium ${bal < 0 ? 'text-red-600' : 'text-ink-900'}`}>
                      {formatMoney(Math.abs(bal), currency)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="card p-4 transition hover:border-brand-300">
            <p className="font-medium text-ink-900">{l.label}</p>
            <p className="mt-1 text-sm text-slate-500">{l.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
