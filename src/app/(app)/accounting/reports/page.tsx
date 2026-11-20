import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { formatMoney } from '@/lib/money';
import { formatDate } from '@/lib/format-date';
import PrintButton from '@/components/print-button';
import { balanceSheet, profitAndLoss, trialBalance, todaySey, dayStart, dayEnd } from '@/lib/ledger-reports';

export const dynamic = 'force-dynamic';

type Report = 'pl' | 'bs' | 'tb' | 'cash';
const TABS: { key: Report; label: string }[] = [
  { key: 'pl', label: 'Profit & Loss' },
  { key: 'bs', label: 'Balance Sheet' },
  { key: 'tb', label: 'Trial Balance' },
  { key: 'cash', label: 'Cash Movement' },
];

function yearStart(d: string) {
  return `${d.slice(0, 4)}-01-01`;
}
const isDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

export default async function FinancialReportsPage({ searchParams }: { searchParams: { report?: string; from?: string; to?: string } }) {
  const report = (TABS.some((t) => t.key === searchParams.report) ? searchParams.report : 'pl') as Report;
  const to = isDate(searchParams.to) ? searchParams.to! : todaySey();
  const from = isDate(searchParams.from) ? searchParams.from! : yearStart(to);
  const settings = await prisma.appSettings.findUnique({ where: { id: 1 } });
  const cur = settings?.currencyCode ?? 'SCR';
  const m = (n: number) => formatMoney(n, cur);
  const showFrom = report === 'pl' || report === 'cash';
  const period = showFrom ? `${formatDate(new Date(`${from}T00:00:00Z`))} – ${formatDate(new Date(`${to}T00:00:00Z`))}` : `As of ${formatDate(new Date(`${to}T00:00:00Z`))}`;

  const AcctLink = ({ id, code, name }: { id: string; code: string | null; name: string }) => (
    <Link href={`/accounting/ledger/${id}?from=${showFrom ? from : ''}&to=${to}`} className="hover:text-brand-600 hover:underline">
      {code ? <span className="mr-2 text-slate-400">{code}</span> : null}
      {name}
    </Link>
  );

  let body: React.ReactNode = null;

  if (report === 'pl') {
    const pl = await profitAndLoss(from, to);
    const Section = ({ title, rows, total, totalLabel }: { title: string; rows: { id: string; code: string | null; name: string; amount: number }[]; total: number; totalLabel: string }) => (
      <>
        <tr>
          <td colSpan={2} className="pt-5 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</td>
        </tr>
        {rows.map((r) => (
          <tr key={r.id} className="border-b border-slate-50">
            <td className="py-1.5 pl-3"><AcctLink {...r} /></td>
            <td className="py-1.5 text-right">{m(r.amount)}</td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <td className="py-1.5 pl-3 text-slate-400">None</td>
            <td />
          </tr>
        )}
        <tr className="font-semibold">
          <td className="py-1.5">{totalLabel}</td>
          <td className="border-t border-slate-300 py-1.5 text-right">{m(total)}</td>
        </tr>
      </>
    );
    body = (
      <table className="w-full text-sm">
        <tbody>
          <Section title="Income" rows={pl.income} total={pl.totalIncome} totalLabel="Total income" />
          <Section title="Cost of sales" rows={pl.cogs} total={pl.totalCogs} totalLabel="Total cost of sales" />
          <tr className="text-base font-bold">
            <td className="pt-3">Gross profit</td>
            <td className="pt-3 text-right">{m(pl.grossProfit)}</td>
          </tr>
          <Section title="Expenses" rows={pl.expenses} total={pl.totalExpenses} totalLabel="Total expenses" />
          {pl.otherIncome.length > 0 && <Section title="Other income" rows={pl.otherIncome} total={pl.totalOtherIncome} totalLabel="Total other income" />}
          <tr className="text-base font-bold">
            <td className="border-t-2 border-ink-900 pt-3">Net profit</td>
            <td className={`border-t-2 border-ink-900 pt-3 text-right ${pl.netProfit < 0 ? 'text-red-600' : ''}`}>{m(pl.netProfit)}</td>
          </tr>
        </tbody>
      </table>
    );
  } else if (report === 'bs') {
    const bs = await balanceSheet(to);
    const Rows = ({ rows }: { rows: { id: string; code: string | null; name: string; amount: number }[] }) => (
      <>
        {rows.map((r) => (
          <tr key={r.id} className="border-b border-slate-50">
            <td className="py-1.5 pl-3"><AcctLink {...r} /></td>
            <td className="py-1.5 text-right">{m(r.amount)}</td>
          </tr>
        ))}
      </>
    );
    body = (
      <table className="w-full text-sm">
        <tbody>
          <tr><td colSpan={2} className="pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Assets</td></tr>
          <Rows rows={bs.assets} />
          <tr className="font-bold"><td className="py-2">Total assets</td><td className="border-t border-slate-300 py-2 text-right">{m(bs.totalAssets)}</td></tr>
          <tr><td colSpan={2} className="pt-5 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Liabilities</td></tr>
          <Rows rows={bs.liabilities} />
          <tr className="font-semibold"><td className="py-2">Total liabilities</td><td className="border-t border-slate-300 py-2 text-right">{m(bs.totalLiabilities)}</td></tr>
          <tr><td colSpan={2} className="pt-5 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Equity</td></tr>
          <Rows rows={bs.equity} />
          <tr className="border-b border-slate-50">
            <td className="py-1.5 pl-3">Profit to date (not yet closed to retained earnings)</td>
            <td className="py-1.5 text-right">{m(bs.earnings)}</td>
          </tr>
          <tr className="font-semibold"><td className="py-2">Total equity</td><td className="border-t border-slate-300 py-2 text-right">{m(bs.totalEquity)}</td></tr>
          <tr className="text-base font-bold">
            <td className="border-t-2 border-ink-900 pt-3">Total liabilities &amp; equity</td>
            <td className="border-t-2 border-ink-900 pt-3 text-right">{m(bs.totalLiabilities + bs.totalEquity)}</td>
          </tr>
          {bs.difference !== 0 && (
            <tr><td colSpan={2} className="pt-3 text-sm text-red-600">Out of balance by {m(bs.difference)}. Run a ledger rebuild under Ledger Tools.</td></tr>
          )}
        </tbody>
      </table>
    );
  } else if (report === 'tb') {
    const tb = await trialBalance(to);
    body = (
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-slate-800 text-left text-xs uppercase text-slate-500">
            <th className="py-2">Account</th>
            <th className="py-2 text-right">Debit</th>
            <th className="py-2 text-right">Credit</th>
          </tr>
        </thead>
        <tbody>
          {tb.lines.map((l) => (
            <tr key={l.id} className="border-b border-slate-50">
              <td className="py-1.5"><AcctLink {...l} /></td>
              <td className="py-1.5 text-right">{l.debit ? m(l.debit) : ''}</td>
              <td className="py-1.5 text-right">{l.credit ? m(l.credit) : ''}</td>
            </tr>
          ))}
          <tr className="font-bold">
            <td className="border-t-2 border-ink-900 py-2">Total</td>
            <td className="border-t-2 border-ink-900 py-2 text-right">{m(tb.totalDebit)}</td>
            <td className="border-t-2 border-ink-900 py-2 text-right">{m(tb.totalCredit)}</td>
          </tr>
        </tbody>
      </table>
    );
  } else {
    // Cash movement: money in / out of each bank, cash and Undeposited Funds account in the period.
    const banks = await prisma.account.findMany({
      where: { OR: [{ bankAccount: { isNot: null } }, { code: '1210' }] },
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true },
    });
    const ids = banks.map((b) => b.id);
    const ph = ids.map((_, i) => `$${i + 3}`).join(',');
    const rows: any[] = ids.length
      ? await prisma.$queryRawUnsafe(
          `SELECT l."accountId",
                  COALESCE(SUM(CASE WHEN e."date" < $1 THEN l."debit" - l."credit" ELSE 0 END),0)::float8 AS "opening",
                  COALESCE(SUM(CASE WHEN e."date" >= $1 AND e."date" < $2 THEN l."debit" ELSE 0 END),0)::float8 AS "inflow",
                  COALESCE(SUM(CASE WHEN e."date" >= $1 AND e."date" < $2 THEN l."credit" ELSE 0 END),0)::float8 AS "outflow"
             FROM "journal_lines" l JOIN "journal_entries" e ON e."id" = l."journalEntryId"
            WHERE e."date" < $2 AND l."accountId" IN (${ph})
            GROUP BY l."accountId"`,
          dayStart(from),
          dayEnd(to),
          ...ids
        )
      : [];
    const by = new Map(rows.map((r) => [r.accountId, r]));
    const lines = banks.map((b) => {
      const r = by.get(b.id) ?? { opening: 0, inflow: 0, outflow: 0 };
      return { ...b, opening: Number(r.opening), inflow: Number(r.inflow), outflow: Number(r.outflow), closing: Number(r.opening) + Number(r.inflow) - Number(r.outflow) };
    });
    const t = (k: 'opening' | 'inflow' | 'outflow' | 'closing') => lines.reduce((s, l) => s + l[k], 0);
    body = (
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-slate-800 text-left text-xs uppercase text-slate-500">
            <th className="py-2">Account</th>
            <th className="py-2 text-right">Opening</th>
            <th className="py-2 text-right">Money in</th>
            <th className="py-2 text-right">Money out</th>
            <th className="py-2 text-right">Closing</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.id} className="border-b border-slate-50">
              <td className="py-1.5"><AcctLink {...l} /></td>
              <td className="py-1.5 text-right">{m(l.opening)}</td>
              <td className="py-1.5 text-right text-emerald-700">{m(l.inflow)}</td>
              <td className="py-1.5 text-right text-red-600">{m(l.outflow)}</td>
              <td className="py-1.5 text-right font-medium">{m(l.closing)}</td>
            </tr>
          ))}
          <tr className="font-bold">
            <td className="border-t-2 border-ink-900 py-2">Total</td>
            <td className="border-t-2 border-ink-900 py-2 text-right">{m(t('opening'))}</td>
            <td className="border-t-2 border-ink-900 py-2 text-right">{m(t('inflow'))}</td>
            <td className="border-t-2 border-ink-900 py-2 text-right">{m(t('outflow'))}</td>
            <td className="border-t-2 border-ink-900 py-2 text-right">{m(t('closing'))}</td>
          </tr>
        </tbody>
      </table>
    );
  }

  const title = TABS.find((t) => t.key === report)!.label;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Financial Reports</h1>
          <p className="text-sm text-slate-500">Straight from the general ledger, accrual basis. Click any account to see its transactions.</p>
        </div>
        <PrintButton />
      </div>

      <div className="flex flex-wrap gap-2 print:hidden">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/accounting/reports?report=${t.key}&from=${from}&to=${to}`}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${t.key === report ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <form className="card flex flex-wrap items-end gap-3 p-4 print:hidden" method="get">
        <input type="hidden" name="report" value={report} />
        {showFrom && (
          <div>
            <label className="label">From</label>
            <input type="date" name="from" defaultValue={from} className="input" />
          </div>
        )}
        <div>
          <label className="label">{showFrom ? 'To' : 'As of'}</label>
          <input type="date" name="to" defaultValue={to} className="input" />
        </div>
        <button className="btn-primary" type="submit">
          Run report
        </button>
      </form>

      <div className="card print-area p-6">
        <div className="mb-4 border-b-2 border-ink-900 pb-3">
          <p className="text-lg font-bold text-ink-900">{settings?.companyName ?? 'Ignite Safety'}</p>
          <p className="text-base font-semibold text-ink-900">{title}</p>
          <p className="text-sm text-slate-500">{period}</p>
        </div>
        {body}
      </div>
    </div>
  );
}
