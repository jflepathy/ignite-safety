import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatMoney } from '@/lib/money';
import { formatDate } from '@/lib/format-date';
import { REBUILD_PARTS } from '@/lib/ledger';
import { accountTotals } from '@/lib/ledger-reports';
import { undepositedItems } from '@/lib/deposits';
import { booksClosedThrough } from '@/lib/period-lock';
import PeriodLockForm from '@/components/accounting/period-lock-form';
import RebuildLedgerButton from '@/components/accounting/rebuild-ledger-button';

export const dynamic = 'force-dynamic';

export default async function LedgerToolsPage() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== 'ADMIN') redirect('/accounting');

  const [settings, totals, invoices, bills, looseCredits, undeposited, banks, lastRuns, closed] = await Promise.all([
    prisma.appSettings.findUnique({ where: { id: 1 } }),
    accountTotals({}),
    prisma.invoice.aggregate({ _sum: { balanceDue: true }, where: { deletedAt: null, status: { notIn: ['DRAFT', 'VOID'] } } }),
    prisma.bill.aggregate({ _sum: { balanceDue: true }, where: { status: { not: 'VOID' } } }),
    prisma.creditNote.aggregate({ _sum: { total: true }, where: { invoiceId: null, status: { in: ['ISSUED', 'APPLIED'] } } }),
    undepositedItems(),
    prisma.bankAccount.findMany({ include: { account: true }, orderBy: { name: 'asc' } }),
    prisma.cronRun.findMany({ where: { job: 'ledger' }, orderBy: { startedAt: 'desc' }, take: 3 }),
    booksClosedThrough(),
  ]);
  const cur = settings?.currencyCode ?? 'SCR';
  const m = (n: number) => formatMoney(n, cur);
  const byCode = new Map(totals.map((t) => [t.code, t]));
  const byId = new Map(totals.map((t) => [t.id, t]));
  const debitBal = (code: string) => {
    const t = byCode.get(code);
    return t ? t.debit - t.credit : 0;
  };
  const totalDebit = totals.reduce((s, t) => s + t.debit, 0);
  const totalCredit = totals.reduce((s, t) => s + t.credit, 0);
  const r2 = (n: number) => Math.round(n * 100) / 100;

  // Note: invoices paid with an overpayment or credit notes not tied to an invoice show here as differences.
  const checks = [
    { label: 'Debits equal credits (all time)', book: totalDebit, ledger: totalCredit, note: 'Every entry must balance.' },
    {
      label: 'Accounts Receivable (1100) vs open invoice balances',
      book: Number(invoices._sum.balanceDue ?? 0) - Number(looseCredits._sum.total ?? 0),
      ledger: debitBal('1100'),
      note: 'Open invoice balances, less credit notes not tied to an invoice.',
    },
    { label: 'Accounts Payable (2000) vs open bill balances', book: Number(bills._sum.balanceDue ?? 0), ledger: -debitBal('2000'), note: '' },
    { label: 'Undeposited Funds (1210) vs money waiting to be deposited', book: undeposited.reduce((s, i) => s + i.amount, 0), ledger: debitBal('1210'), note: '' },
    ...banks.map((b) => {
      const t = byId.get(b.accountId);
      return { label: `${b.name}: shown balance vs ledger`, book: Number(b.currentBalance), ledger: t ? t.debit - t.credit : 0, note: '' };
    }),
  ];
  const suggestion = (() => {
    const d = new Date(Date.now() + 4 * 3600 * 1000);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 0)).toISOString().slice(0, 10);
  })();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">Ledger Tools</h1>
        <p className="text-sm text-slate-500">
          Every invoice, payment, receipt, bill, expense, transfer and deposit posts a balanced journal entry automatically. These tools check
          and protect those books.
        </p>
      </div>

      <div className="card p-6">
        <h2 className="mb-3 text-sm font-semibold text-ink-900">Health checks</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
              <th className="py-2">Check</th>
              <th className="py-2 text-right">Documents</th>
              <th className="py-2 text-right">Ledger</th>
              <th className="py-2 text-right">Difference</th>
            </tr>
          </thead>
          <tbody>
            {checks.map((c) => {
              const diff = r2(c.book - c.ledger);
              return (
                <tr key={c.label} className="border-b border-slate-50">
                  <td className="py-2">
                    {c.label}
                    {c.note && <span className="block text-xs text-slate-400">{c.note}</span>}
                  </td>
                  <td className="py-2 text-right">{m(c.book)}</td>
                  <td className="py-2 text-right">{m(c.ledger)}</td>
                  <td className={`py-2 text-right font-medium ${diff === 0 ? 'text-emerald-600' : 'text-red-600'}`}>{diff === 0 ? '✓' : m(diff)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-slate-400">
          Last nightly rebuild:{' '}
          {lastRuns.length ? lastRuns.map((r) => `${formatDate(r.startedAt)} ${r.ok ? 'OK' : 'FAILED'}`).join(', ') : 'not run yet'}.{' '}
          <Link href="/accounting/reports" className="text-brand-600 hover:underline">
            Open financial reports
          </Link>
        </p>
      </div>

      <div className="card p-6">
        <h2 className="mb-3 text-sm font-semibold text-ink-900">Rebuild the ledger</h2>
        <p className="mb-3 text-sm text-slate-600">
          Re-posts every document from scratch. Safe to run any time; it also runs automatically every night. Manual journal entries are left
          untouched.
        </p>
        <RebuildLedgerButton parts={REBUILD_PARTS} />
      </div>

      <div className="card p-6">
        <h2 className="mb-3 text-sm font-semibold text-ink-900">Close the books (period lock)</h2>
        <PeriodLockForm closedThrough={closed} suggestion={suggestion} />
      </div>
    </div>
  );
}
