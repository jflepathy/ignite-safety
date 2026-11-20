'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type BankAccountOption = { id: string; name: string };
export type DepositItemOption = {
  kind: 'payment' | 'receipt';
  id: string;
  date: string;
  label: string;
  customer: string;
  method: string;
  amount: number;
};

export default function DepositForm({
  bankAccounts,
  items,
  currency,
}: {
  bankAccounts: BankAccountOption[];
  items: DepositItemOption[];
  currency: string;
}) {
  const router = useRouter();
  const [bankAccountId, setBankAccountId] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [memo, setMemo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const key = (i: DepositItemOption) => `${i.kind}:${i.id}`;
  const total = useMemo(
    () => items.filter((i) => selected.includes(key(i))).reduce((s, i) => s + i.amount, 0),
    [items, selected]
  );

  async function submit() {
    if (!bankAccountId) return setError('Choose the account the money was deposited into.');
    setSubmitting(true);
    setError('');
    try {
      const pick = items.filter((i) => selected.includes(key(i)));
      const res = await fetch('/api/deposits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bankAccountId,
          date,
          memo: memo || undefined,
          paymentIds: pick.filter((i) => i.kind === 'payment').map((i) => i.id),
          receiptIds: pick.filter((i) => i.kind === 'receipt').map((i) => i.id),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.formErrors?.[0] ?? body?.message ?? 'Failed to save');
      }
      router.push('/accounting/deposits');
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  const fmt = (n: number) => `${currency} ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-4">
      <div className="card overflow-x-auto">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <p className="text-sm font-semibold text-ink-900">Money waiting to be deposited ({items.length})</p>
          {items.length > 0 && (
            <button
              type="button"
              className="text-xs text-brand-600 hover:underline"
              onClick={() => setSelected(selected.length === items.length ? [] : items.map(key))}
            >
              {selected.length === items.length ? 'Clear all' : 'Select all'}
            </button>
          )}
        </div>
        <table className="w-full text-sm">
          <tbody>
            {items.map((i) => {
              const checked = selected.includes(key(i));
              return (
                <tr key={key(i)} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="w-10 px-4 py-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={checked}
                      onChange={() => setSelected((p) => (checked ? p.filter((x) => x !== key(i)) : [...p, key(i)]))}
                    />
                  </td>
                  <td className="px-2 py-2 text-slate-500">{i.date}</td>
                  <td className="px-2 py-2 text-ink-900">{i.label}</td>
                  <td className="px-2 py-2 text-slate-500">{i.customer}</td>
                  <td className="px-2 py-2 text-slate-500">{i.method.replace('_', ' ')}</td>
                  <td className="px-4 py-2 text-right font-medium">{fmt(i.amount)}</td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td className="px-4 py-8 text-center text-slate-400">Nothing waiting. Payments and receipts saved straight into a bank account don&apos;t need a deposit.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card grid max-w-xl grid-cols-1 gap-4 p-6">
        <div>
          <label className="label">Deposit to</label>
          <select className="input" value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)}>
            <option value="">Select account…</option>
            {bankAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Deposit total</label>
            <p className="input bg-slate-50 font-semibold">{fmt(total)}</p>
          </div>
        </div>
        <div>
          <label className="label">Memo</label>
          <textarea className="input" rows={2} value={memo} onChange={(e) => setMemo(e.target.value)} />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end">
          <button className="btn-primary" disabled={submitting || selected.length === 0} onClick={submit}>
            {submitting ? 'Saving…' : `Save Deposit${selected.length ? ` (${selected.length})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
