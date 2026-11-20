import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { formatMoney } from '@/lib/money';
import { formatDate } from '@/lib/format-date';
import PrintButton from '@/components/print-button';
import { dayStart, dayEnd, todaySey, sourceLinks } from '@/lib/ledger-reports';

export const dynamic = 'force-dynamic';
const isDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Every ledger line on one account, with a running balance and a link back to the document. */
export default async function AccountLedgerPage({
  params,
  searchParams,
}: {
  params: { accountId: string };
  searchParams: { from?: string; to?: string };
}) {
  const account = await prisma.account.findUnique({ where: { id: params.accountId } });
  if (!account) notFound();
  const to = isDate(searchParams.to) ? searchParams.to! : todaySey();
  const from = isDate(searchParams.from) ? searchParams.from! : `${to.slice(0, 4)}-01-01`;
  const debitNormal = account.type === 'ASSET' || account.type === 'EXPENSE';
  const sign = debitNormal ? 1 : -1;

  const [settings, before, lines] = await Promise.all([
    prisma.appSettings.findUnique({ where: { id: 1 } }),
    prisma.journalLine.aggregate({
      _sum: { debit: true, credit: true },
      where: { accountId: account.id, journalEntry: { date: { lt: dayStart(from) } } },
    }),
    prisma.journalLine.findMany({
      where: { accountId: account.id, journalEntry: { date: { gte: dayStart(from), lt: dayEnd(to) } } },
      include: { journalEntry: { select: { date: true, memo: true, entryNumber: true, sourceType: true, sourceId: true } } },
      orderBy: [{ journalEntry: { date: 'asc' } }, { journalEntry: { createdAt: 'asc' } }],
      take: 2000,
    }),
  ]);
  const cur = settings?.currencyCode ?? 'SCR';
  const opening = sign * (Number(before._sum.debit ?? 0) - Number(before._sum.credit ?? 0));
  const link = await sourceLinks(lines.map((l) => l.journalEntry));
  let running = opening;
  const rows = lines.map((l) => {
    running += sign * (Number(l.debit) - Number(l.credit));
    return { l, balance: running };
  });
  const totalDebit = lines.reduce((s, l) => s + Number(l.debit), 0);
  const totalCredit = lines.reduce((s, l) => s + Number(l.credit), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <Link href="/accounting/chart-of-accounts" className="text-sm text-slate-500 hover:underline">
            ← Chart of Accounts
          </Link>
          <h1 className="text-2xl font-semibold text-ink-900">
            {account.code ? `${account.code} · ` : ''}
            {account.name}
          </h1>
          <p className="text-sm text-slate-500">
            {account.type.charAt(0) + account.type.slice(1).toLowerCase()}
            {account.subtype ? ` · ${account.subtype}` : ''}
          </p>
        </div>
        <PrintButton />
      </div>

      <form className="card flex flex-wrap items-end gap-3 p-4 print:hidden" method="get">
        <div>
          <label className="label">From</label>
          <input type="date" name="from" defaultValue={from} className="input" />
        </div>
        <div>
          <label className="label">To</label>
          <input type="date" name="to" defaultValue={to} className="input" />
        </div>
        <button className="btn-primary" type="submit">
          Show
        </button>
      </form>

      <div className="card print-area overflow-x-auto p-6">
        <p className="mb-3 text-sm text-slate-500">
          {formatDate(new Date(`${from}T00:00:00Z`))} – {formatDate(new Date(`${to}T00:00:00Z`))}
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-slate-800 text-left text-xs uppercase text-slate-500">
              <th className="py-2">Date</th>
              <th className="py-2">Type</th>
              <th className="py-2">Details</th>
              <th className="py-2 text-right">Debit</th>
              <th className="py-2 text-right">Credit</th>
              <th className="py-2 text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100 text-slate-500">
              <td className="py-1.5" colSpan={5}>
                Opening balance
              </td>
              <td className="py-1.5 text-right">{formatMoney(opening, cur)}</td>
            </tr>
            {rows.map(({ l, balance }) => {
              const src = link(l.journalEntry.sourceType, l.journalEntry.sourceId);
              return (
                <tr key={l.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="whitespace-nowrap py-1.5 text-slate-500">{formatDate(l.journalEntry.date)}</td>
                  <td className="whitespace-nowrap py-1.5">
                    <Link href={src.href} className="text-brand-600 hover:underline">
                      {src.label}
                    </Link>
                  </td>
                  <td className="py-1.5 text-slate-700">{l.description ?? l.journalEntry.memo ?? l.journalEntry.entryNumber}</td>
                  <td className="py-1.5 text-right">{Number(l.debit) ? formatMoney(l.debit.toString(), cur) : ''}</td>
                  <td className="py-1.5 text-right">{Number(l.credit) ? formatMoney(l.credit.toString(), cur) : ''}</td>
                  <td className="py-1.5 text-right font-medium">{formatMoney(balance, cur)}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  No transactions in this period.
                </td>
              </tr>
            )}
            <tr className="font-bold">
              <td colSpan={3} className="border-t-2 border-ink-900 py-2">
                Totals / closing balance
              </td>
              <td className="border-t-2 border-ink-900 py-2 text-right">{formatMoney(totalDebit, cur)}</td>
              <td className="border-t-2 border-ink-900 py-2 text-right">{formatMoney(totalCredit, cur)}</td>
              <td className="border-t-2 border-ink-900 py-2 text-right">{formatMoney(running, cur)}</td>
            </tr>
          </tbody>
        </table>
        {lines.length === 2000 && <p className="mt-2 text-xs text-amber-600">Showing the first 2,000 lines. Narrow the dates to see the rest.</p>}
      </div>
    </div>
  );
}
