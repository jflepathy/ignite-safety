import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { formatMoney } from '@/lib/money';

export default async function AccountingOverviewPage() {
  const [bankAccounts, settings] = await Promise.all([
    prisma.bankAccount.findMany({ orderBy: { name: 'asc' } }),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
  ]);
  const currency = settings?.currencyCode ?? 'SCR';
  const totalCash = bankAccounts.reduce((s, a) => s + Number(a.currentBalance), 0);

  const links = [
    { label: 'Chart of Accounts', href: '/accounting/chart-of-accounts', desc: 'Assets, liabilities, equity, income & expense accounts.' },
    { label: 'Reconcile', href: '/accounting/reconcile', desc: 'Match bank transactions against your books.' },
    { label: 'Bank Deposits', href: '/accounting/deposits', desc: 'Group payments into a single bank deposit.' },
    { label: 'Transfers', href: '/accounting/transfers', desc: 'Move money between accounts.' },
    { label: 'Journal Entries', href: '/accounting/journal-entries', desc: 'Manual double-entry postings.' },
    { label: 'Audit Log', href: '/accounting/audit-log', desc: 'Who changed what, and when.' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">Accounting</h1>
        <p className="text-sm text-slate-500">Books, banking and the audit trail.</p>
      </div>

      <div className="card p-4">
        <p className="text-xs uppercase text-slate-500">Total Cash on Hand</p>
        <p className="text-2xl font-semibold text-ink-900">{formatMoney(totalCash, currency)}</p>
        <p className="mt-1 text-xs text-slate-400">{bankAccounts.length} bank account(s)</p>
      </div>

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
