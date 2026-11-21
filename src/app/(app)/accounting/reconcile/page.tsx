import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { formatMoney } from '@/lib/money';
import { formatDate } from '@/lib/format-date';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { findCandidates } from '@/lib/reconcile';
import { SOURCE_LABEL, type SourceType } from '@/lib/ledger';
import { dayEnd } from '@/lib/ledger-reports';
import ReconcileTable, { type RecLine } from '@/components/accounting/reconcile-table';
import { AutoMatchButton, UndoImportButton } from '@/components/accounting/reconcile-buttons';

export const dynamic = 'force-dynamic';

type Show = 'open' | 'matched' | 'excluded' | 'all' | 'books';

/**
 * Bank reconciliation (accounting plan, Phase 3): statement lines on the left,
 * what the books say on the right. Match, move (from Petty Cash / another
 * account) or record each line until nothing is left open.
 */
export default async function ReconcilePage({ searchParams }: { searchParams: { bank?: string; show?: string } }) {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user.role === 'ADMIN';
  const banks = await prisma.bankAccount.findMany({ orderBy: { name: 'asc' } });
  const bank =
    banks.find((b) => b.id === searchParams.bank) ?? banks.find((b) => b.accountType !== 'INTERCOMPANY' && /absa/i.test(b.name)) ?? banks[0];
  const show: Show = (['open', 'matched', 'excluded', 'all', 'books'] as const).includes(searchParams.show as Show) ? (searchParams.show as Show) : 'open';
  if (!bank) return <p className="text-sm text-slate-500">No bank accounts set up yet.</p>;

  const settings = await prisma.appSettings.findUnique({ where: { id: 1 } });
  const cur = settings?.currencyCode ?? 'SCR';
  const m = (n: number | string) => formatMoney(n, cur);

  const countsRaw: any[] = await prisma.$queryRawUnsafe(
    `SELECT
       COUNT(*) FILTER (WHERE "matchType" IS NULL AND NOT "excluded")::int AS open,
       COUNT(*) FILTER (WHERE "matchType" IS NOT NULL)::int AS matched,
       COUNT(*) FILTER (WHERE "excluded")::int AS excluded,
       COUNT(*)::int AS total
     FROM "bank_transactions" WHERE "bankAccountId" = $1`,
    bank.id
  );
  const counts = countsRaw[0] ?? { open: 0, matched: 0, excluded: 0, total: 0 };

  const imports = await prisma.bankStatementImport.findMany({ where: { bankAccountId: bank.id }, orderBy: { toDate: 'desc' }, take: 8 });
  const latest = imports.find((i) => i.closingBalance != null && i.toDate);
  let ledgerAtStatement: number | null = null;
  if (latest?.toDate) {
    const agg = await prisma.journalLine.aggregate({
      _sum: { debit: true, credit: true },
      where: { accountId: bank.accountId, journalEntry: { date: { lt: dayEnd(latest.toDate.toISOString().slice(0, 10)) } } },
    });
    ledgerAtStatement = Number(agg._sum.debit ?? 0) - Number(agg._sum.credit ?? 0);
  }

  // ----- statement lines -----
  let lines: RecLine[] = [];
  let booksOnly: { key: string; date: Date; label: string; amount: number }[] = [];
  const where: any = { bankAccountId: bank.id };
  if (show === 'open') Object.assign(where, { matchType: null, excluded: false });
  if (show === 'matched') Object.assign(where, { matchType: { not: null } });
  if (show === 'excluded') Object.assign(where, { excluded: true });

  if (show !== 'books') {
    const txns = await prisma.bankTransaction.findMany({ where, orderBy: [{ date: 'asc' }, { createdAt: 'asc' }], take: 300 });
    const open = txns.filter((t) => !t.matchType && !t.excluded);
    const cands = await findCandidates(
      bank.id,
      open.map((t) => ({ id: t.id, date: t.date, amount: Number(t.amount), description: t.description, reference: t.reference }))
    );
    // Labels for matched lines (one query per document type present).
    const byType = new Map<string, string[]>();
    for (const t of txns) if (t.matchType && t.matchId) byType.set(t.matchType, [...(byType.get(t.matchType) ?? []), t.matchId]);
    const label = new Map<string, string>();
    const ids = (k: string) => byType.get(k) ?? [];
    if (ids('PAYMENT').length)
      for (const p of await prisma.payment.findMany({ where: { id: { in: ids('PAYMENT') } }, include: { invoice: { select: { invoiceNumber: true, customer: { select: { displayName: true } } } } } }))
        label.set(`PAYMENT:${p.id}`, `Payment · ${p.invoice.invoiceNumber} · ${p.invoice.customer.displayName}`);
    if (ids('SALES_RECEIPT').length)
      for (const r of await prisma.salesReceipt.findMany({ where: { id: { in: ids('SALES_RECEIPT') } }, include: { customer: { select: { displayName: true } } } }))
        label.set(`SALES_RECEIPT:${r.id}`, `Sales receipt ${r.receiptNumber} · ${r.customer.displayName}`);
    if (ids('EXPENSE').length)
      for (const e of await prisma.expense.findMany({ where: { id: { in: ids('EXPENSE') } } }))
        label.set(`EXPENSE:${e.id}`, `Expense ${e.expenseNumber ?? ''} · ${e.category}`);
    if (ids('BILL_PAYMENT').length)
      for (const p of await prisma.supplierPayment.findMany({ where: { id: { in: ids('BILL_PAYMENT') } }, include: { bill: { select: { billNumber: true } } } }))
        label.set(`BILL_PAYMENT:${p.id}`, `Bill payment · ${p.bill.billNumber}`);
    if (ids('REFUND_RECEIPT').length)
      for (const r of await prisma.refundReceipt.findMany({ where: { id: { in: ids('REFUND_RECEIPT') } } })) label.set(`REFUND_RECEIPT:${r.id}`, `Refund ${r.refundNumber}`);
    if (ids('TRANSFER').length)
      for (const t of await prisma.accountTransfer.findMany({ where: { id: { in: ids('TRANSFER') } }, include: { fromAccount: true, toAccount: true } }))
        label.set(`TRANSFER:${t.id}`, `Transfer ${t.fromAccount.name} → ${t.toAccount.name}`);
    if (ids('DEPOSIT').length)
      for (const d of await prisma.deposit.findMany({ where: { id: { in: ids('DEPOSIT') } } })) label.set(`DEPOSIT:${d.id}`, `Deposit ${formatDate(d.date)}`);
    if (ids('JOURNAL').length)
      for (const j of await prisma.journalEntry.findMany({ where: { id: { in: ids('JOURNAL') } } })) label.set(`JOURNAL:${j.id}`, `Journal ${j.entryNumber}`);

    lines = txns.map((t) => {
      const key = `${t.matchType}:${t.matchId}`;
      return {
        id: t.id,
        date: formatDate(t.date),
        description: t.description,
        reference: t.reference,
        amount: Number(t.amount),
        balance: t.balance == null ? null : Number(t.balance),
        status: t.excluded ? 'excluded' : t.matchType ? 'matched' : 'open',
        matchLabel: t.matchType ? label.get(key) ?? SOURCE_LABEL[t.matchType as SourceType] ?? t.matchType : null,
        matchMissing: !!t.matchType && !label.has(key),
        note: t.note,
        candidates: (cands.get(t.id) ?? []).map((c) => ({
          type: c.type,
          id: c.id,
          label: c.label,
          date: formatDate(c.date),
          mode: c.mode,
          bankName: c.bankName,
        })),
      };
    });
  } else if (imports.length) {
    // In the books on this bank, within the imported statement dates, but not on any statement line.
    const from = imports.reduce((a, i) => (i.fromDate && i.fromDate < a ? i.fromDate : a), imports[0].fromDate ?? new Date());
    const to = new Date((imports[0].toDate ?? new Date()).getTime() + 24 * 3600 * 1000);
    const matched = new Set(
      (await prisma.bankTransaction.findMany({ where: { matchType: { not: null } }, select: { matchType: true, matchId: true } })).map((r) => `${r.matchType}:${r.matchId}`)
    );
    const [p, r, e, sp, rf, tr, dp] = await Promise.all([
      prisma.payment.findMany({ where: { bankAccountId: bank.id, paidAt: { gte: from, lt: to } }, include: { invoice: { select: { invoiceNumber: true, customer: { select: { displayName: true } } } } } }),
      prisma.salesReceipt.findMany({ where: { bankAccountId: bank.id, saleDate: { gte: from, lt: to } }, include: { customer: { select: { displayName: true } } } }),
      prisma.expense.findMany({ where: { bankAccountId: bank.id, date: { gte: from, lt: to } } }),
      prisma.supplierPayment.findMany({ where: { bankAccountId: bank.id, paidAt: { gte: from, lt: to } }, include: { bill: { select: { billNumber: true } } } }),
      prisma.refundReceipt.findMany({ where: { bankAccountId: bank.id, refundDate: { gte: from, lt: to } } }),
      prisma.accountTransfer.findMany({ where: { date: { gte: from, lt: to }, OR: [{ fromAccountId: bank.accountId }, { toAccountId: bank.accountId }] }, include: { fromAccount: true, toAccount: true } }),
      prisma.deposit.findMany({ where: { bankAccountId: bank.id, date: { gte: from, lt: to } } }),
    ]);
    booksOnly = [
      ...p.map((x) => ({ key: `PAYMENT:${x.id}`, date: x.paidAt, label: `Payment · ${x.invoice.invoiceNumber} · ${x.invoice.customer.displayName}`, amount: Number(x.amount) })),
      ...r.map((x) => ({ key: `SALES_RECEIPT:${x.id}`, date: x.saleDate, label: `Sales receipt ${x.receiptNumber} · ${x.customer.displayName}`, amount: Number(x.total) })),
      ...e.map((x) => ({ key: `EXPENSE:${x.id}`, date: x.date, label: `Expense ${x.expenseNumber ?? ''} · ${x.category}`, amount: -Number(x.amount) })),
      ...sp.map((x) => ({ key: `BILL_PAYMENT:${x.id}`, date: x.paidAt, label: `Bill payment · ${x.bill.billNumber}`, amount: -Number(x.amount) })),
      ...rf.map((x) => ({ key: `REFUND_RECEIPT:${x.id}`, date: x.refundDate, label: `Refund ${x.refundNumber}`, amount: -Number(x.total) })),
      ...tr.map((x) => ({
        key: `TRANSFER:${x.id}`,
        date: x.date,
        label: `Transfer ${x.fromAccount.name} → ${x.toAccount.name}`,
        amount: x.toAccountId === bank.accountId ? Number(x.amount) : -Number(x.amount),
      })),
      ...dp.map((x) => ({ key: `DEPOSIT:${x.id}`, date: x.date, label: 'Deposit', amount: Number(x.amount) })),
    ]
      .filter((x) => !matched.has(x.key))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  // ----- options for "Record as…" -----
  const needOptions = show === 'open' || show === 'all';
  const [expenseAccounts, otherAccounts, invoices, bills] = needOptions
    ? await Promise.all([
        prisma.account.findMany({ where: { type: 'EXPENSE', isActive: true }, orderBy: { code: 'asc' } }),
        prisma.account.findMany({ where: { isActive: true, type: { in: ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME'] }, id: { not: bank.accountId } }, orderBy: { code: 'asc' } }),
        prisma.invoice.findMany({
          where: { deletedAt: null, status: { notIn: ['VOID', 'PAID'] }, balanceDue: { gt: 0 } },
          include: { customer: { select: { displayName: true } } },
          orderBy: { issueDate: 'desc' },
          take: 300,
        }),
        prisma.bill.findMany({ where: { status: { notIn: ['VOID', 'PAID'] }, balanceDue: { gt: 0 } }, include: { supplier: { select: { displayName: true } } }, take: 200 }),
      ])
    : [[], [], [], []];
  const acctLabel = (a: { code: string | null; name: string }) => (a.code ? `${a.code} · ${a.name}` : a.name);

  const tab = (k: Show, label: string, n?: number) => (
    <Link
      key={k}
      href={`/accounting/reconcile?bank=${bank.id}&show=${k}`}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium ${show === k ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}`}
    >
      {label}
      {n != null ? ` (${n})` : ''}
    </Link>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Reconcile</h1>
          <p className="text-sm text-slate-500">
            Import a bank statement, then match each line to what&apos;s in the books. Amber buttons move an entry recorded on another account
            (e.g. Petty Cash) onto this bank.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AutoMatchButton bankAccountId={bank.id} />
          <Link href={`/accounting/reconcile/import?bank=${bank.id}`} className="btn-primary">
            Import statement
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {banks.map((b) => (
          <Link
            key={b.id}
            href={`/accounting/reconcile?bank=${b.id}`}
            className={`rounded-full px-3 py-1 text-sm ${b.id === bank.id ? 'bg-ink-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}`}
          >
            {b.name}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-4">
          <p className="text-xs uppercase text-slate-500">Balance in the books</p>
          <p className="text-2xl font-semibold text-ink-900">{m(bank.currentBalance.toString())}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase text-slate-500">Last statement balance</p>
          <p className="text-2xl font-semibold text-ink-900">{latest?.closingBalance != null ? m(latest.closingBalance.toString()) : '—'}</p>
          {latest?.toDate && <p className="text-xs text-slate-400">at {formatDate(latest.toDate)}</p>}
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase text-slate-500">Books at that date</p>
          <p className="text-2xl font-semibold text-ink-900">{ledgerAtStatement != null ? m(ledgerAtStatement) : '—'}</p>
          {latest?.closingBalance != null && ledgerAtStatement != null && (
            <p className={`text-xs ${Math.abs(Number(latest.closingBalance) - ledgerAtStatement) < 0.005 ? 'text-emerald-600' : 'text-amber-600'}`}>
              {Math.abs(Number(latest.closingBalance) - ledgerAtStatement) < 0.005
                ? 'Agrees with the statement ✓'
                : `Difference ${m(Number(latest.closingBalance) - ledgerAtStatement)}`}
            </p>
          )}
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase text-slate-500">Lines to sort out</p>
          <p className={`text-2xl font-semibold ${counts.open ? 'text-amber-600' : 'text-emerald-600'}`}>{counts.open}</p>
          <p className="text-xs text-slate-400">
            {counts.matched} matched · {counts.excluded} excluded
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {tab('open', 'To match', counts.open)}
        {tab('matched', 'Matched', counts.matched)}
        {tab('excluded', 'Excluded', counts.excluded)}
        {tab('all', 'All', counts.total)}
        {tab('books', 'In books, not on statement')}
      </div>

      <div className="card overflow-x-auto">
        {show === 'books' ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Entry in the books</th>
                <th className="px-4 py-2 text-right">In</th>
                <th className="px-4 py-2 text-right">Out</th>
              </tr>
            </thead>
            <tbody>
              {booksOnly.map((b) => (
                <tr key={b.key} className="border-b border-slate-50">
                  <td className="px-4 py-2 text-slate-500">{formatDate(b.date)}</td>
                  <td className="px-4 py-2">{b.label}</td>
                  <td className="px-4 py-2 text-right text-emerald-700">{b.amount > 0 ? m(b.amount) : ''}</td>
                  <td className="px-4 py-2 text-right text-red-600">{b.amount < 0 ? m(-b.amount) : ''}</td>
                </tr>
              ))}
              {booksOnly.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-slate-400">
                    {imports.length ? 'Everything in the books for the imported dates is on a statement.' : 'Import a statement first.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          <ReconcileTable
            lines={lines}
            expenseAccounts={expenseAccounts.map((a) => ({ id: a.id, label: acctLabel(a) }))}
            otherAccounts={otherAccounts.map((a) => ({ id: a.id, label: acctLabel(a) }))}
            openInvoices={invoices.map((i) => ({
              id: i.id,
              label: `${i.invoiceNumber} · ${i.customer.displayName} · ${m(i.balanceDue.toString())}`,
              amount: Number(i.balanceDue),
            }))}
            openBills={bills.map((b) => ({ id: b.id, label: `${b.billNumber} · ${b.supplier.displayName} · ${m(b.balanceDue.toString())}`, amount: Number(b.balanceDue) }))}
          />
        )}
      </div>

      {imports.length > 0 && (
        <div className="card p-4">
          <p className="mb-2 text-sm font-semibold text-ink-900">Imported statements</p>
          <table className="w-full text-sm">
            <tbody>
              {imports.map((i) => (
                <tr key={i.id} className="border-t border-slate-50">
                  <td className="py-1.5">{i.fileName ?? 'Statement'}</td>
                  <td className="py-1.5 text-slate-500">
                    {i.fromDate ? formatDate(i.fromDate) : ''} – {i.toDate ? formatDate(i.toDate) : ''}
                  </td>
                  <td className="py-1.5 text-slate-500">
                    {i.importedCount} of {i.rowCount} lines new
                  </td>
                  <td className="py-1.5 text-slate-500">{i.closingBalance != null ? `closing ${m(i.closingBalance.toString())}` : ''}</td>
                  <td className="py-1.5 text-right">{isAdmin && <UndoImportButton importId={i.id} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
