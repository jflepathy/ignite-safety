import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { formatMoney } from '@/lib/money';
import { formatDate } from '@/lib/format-date';

export default async function JournalEntriesPage() {
  const [entries, settings] = await Promise.all([
    prisma.journalEntry.findMany({ include: { lines: { include: { account: true } } }, orderBy: { date: 'desc' } }),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
  ]);
  const currency = settings?.currencyCode ?? 'SCR';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Journal Entries</h1>
          <p className="text-sm text-slate-500">Manual double-entry postings. Debits always equal credits.</p>
        </div>
        <Link href="/accounting/journal-entries/new" className="btn-primary">
          + New Journal Entry
        </Link>
      </div>

      <div className="space-y-4">
        {entries.map((e) => {
          const total = e.lines.reduce((s, l) => s + Number(l.debit), 0);
          return (
            <div key={e.id} className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <div>
                  <p className="font-medium text-ink-900">{e.entryNumber}</p>
                  <p className="text-xs text-slate-500">
                    {formatDate(e.date)} {e.memo ? `— ${e.memo}` : ''}
                  </p>
                </div>
                <p className="text-sm font-medium text-ink-900">{formatMoney(total, currency)}</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
                    <th className="px-4 py-2">Account</th>
                    <th className="px-4 py-2">Description</th>
                    <th className="px-4 py-2 text-right">Debit</th>
                    <th className="px-4 py-2 text-right">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {e.lines.map((l) => (
                    <tr key={l.id} className="border-b border-slate-50">
                      <td className="px-4 py-2 text-ink-900">{l.account.name}</td>
                      <td className="px-4 py-2 text-slate-500">{l.description ?? '—'}</td>
                      <td className="px-4 py-2 text-right">{Number(l.debit) > 0 ? formatMoney(l.debit.toString(), currency) : ''}</td>
                      <td className="px-4 py-2 text-right">{Number(l.credit) > 0 ? formatMoney(l.credit.toString(), currency) : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
        {entries.length === 0 && <p className="text-sm text-slate-400">No journal entries yet.</p>}
      </div>
    </div>
  );
}
