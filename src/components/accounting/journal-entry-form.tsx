'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type AccountOption = { id: string; name: string; code: string | null };

type Line = { key: string; accountId: string; debit: number; credit: number; description: string };

function emptyLine(accountId: string): Line {
  return { key: Math.random().toString(36).slice(2), accountId, debit: 0, credit: 0, description: '' };
}

export default function JournalEntryForm({ accounts }: { accounts: AccountOption[] }) {
  const router = useRouter();
  const firstAccount = accounts[0]?.id ?? '';
  const [memo, setMemo] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<Line[]>([emptyLine(firstAccount), emptyLine(firstAccount)]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function updateLine(key: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }
  // Reorder lines (Session 21).
  function moveLine(key: string, direction: -1 | 1) {
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.key === key);
      const swapIdx = idx + direction;
      if (idx === -1 || swapIdx < 0 || swapIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return next;
    });
  }

  const totals = useMemo(() => {
    const debit = Math.round(lines.reduce((s, l) => s + l.debit, 0) * 100) / 100;
    const credit = Math.round(lines.reduce((s, l) => s + l.credit, 0) * 100) / 100;
    return { debit, credit, balanced: debit === credit && debit > 0 };
  }, [lines]);

  async function submit() {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/journal-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memo: memo || undefined,
          date,
          lines: lines.map((l) => ({ accountId: l.accountId, debit: l.debit, credit: l.credit, description: l.description || undefined })),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ? JSON.stringify(body.error) : 'Failed to save');
      }
      router.push('/accounting/journal-entries');
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="card grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
        <div>
          <label className="label">Date</label>
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="label">Memo</label>
          <input className="input" value={memo} onChange={(e) => setMemo(e.target.value)} />
        </div>
      </div>

      <div className="card p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink-900">Lines</h2>
          <button type="button" className="btn-secondary" onClick={() => setLines((p) => [...p, emptyLine(firstAccount)])}>
            + Add line
          </button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-500">
              <th className="py-2 pr-2">Account</th>
              <th className="py-2 pr-2">Description</th>
              <th className="w-28 py-2 text-right">Debit</th>
              <th className="w-28 py-2 text-right">Credit</th>
              <th className="w-14 py-2" />
              <th className="w-8 py-2" />
            </tr>
          </thead>
          <tbody>
            {lines.map((line, idx) => (
              <tr key={line.key} className="border-t border-slate-100">
                <td className="py-2 pr-2">
                  <select className="input" value={line.accountId} onChange={(e) => updateLine(line.key, { accountId: e.target.value })}>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code ? `${a.code} — ` : ''}
                        {a.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-2 pr-2">
                  <input className="input" value={line.description} onChange={(e) => updateLine(line.key, { description: e.target.value })} />
                </td>
                <td className="py-2 pr-2">
                  <input
                    type="number"
                    step="0.01"
                    className="input text-right"
                    value={line.debit}
                    onChange={(e) => updateLine(line.key, { debit: parseFloat(e.target.value) || 0, credit: 0 })}
                  />
                </td>
                <td className="py-2 pr-2">
                  <input
                    type="number"
                    step="0.01"
                    className="input text-right"
                    value={line.credit}
                    onChange={(e) => updateLine(line.key, { credit: parseFloat(e.target.value) || 0, debit: 0 })}
                  />
                </td>
                <td className="py-2">
                  <div className="flex items-center justify-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => moveLine(line.key, -1)}
                      disabled={idx === 0}
                      className="text-slate-400 hover:text-ink-900 disabled:pointer-events-none disabled:opacity-25"
                      aria-label="Move line up"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => moveLine(line.key, 1)}
                      disabled={idx === lines.length - 1}
                      className="text-slate-400 hover:text-ink-900 disabled:pointer-events-none disabled:opacity-25"
                      aria-label="Move line down"
                    >
                      ▼
                    </button>
                  </div>
                </td>
                <td className="py-2 text-right">
                  {lines.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setLines((p) => p.filter((l) => l.key !== line.key))}
                      className="text-slate-400 hover:text-red-600"
                    >
                      ✕
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 flex justify-end gap-8 text-sm">
          <span>
            Debits: <span className="font-medium text-ink-900">{totals.debit.toFixed(2)}</span>
          </span>
          <span>
            Credits: <span className="font-medium text-ink-900">{totals.credit.toFixed(2)}</span>
          </span>
          <span className={totals.balanced ? 'text-emerald-600' : 'text-red-600'}>
            {totals.balanced ? 'Balanced' : 'Not balanced'}
          </span>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end">
        <button className="btn-primary" disabled={submitting || !totals.balanced} onClick={submit}>
          {submitting ? 'Saving…' : 'Save Journal Entry'}
        </button>
      </div>
    </div>
  );
}
