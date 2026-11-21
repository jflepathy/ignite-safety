'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type RecLine = {
  id: string;
  date: string;
  description: string;
  reference: string | null;
  amount: number;
  balance: number | null;
  status: 'open' | 'matched' | 'excluded';
  matchLabel: string | null;
  matchMissing: boolean;
  note: string | null;
  candidates: { type: string; id: string; label: string; date: string; mode: 'match' | 'move'; bankName: string }[];
};
type Opt = { id: string; label: string; amount?: number };

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ReconcileTable({
  lines,
  expenseAccounts,
  otherAccounts,
  openInvoices,
  openBills,
}: {
  lines: RecLine[];
  expenseAccounts: Opt[];
  otherAccounts: Opt[];
  openInvoices: Opt[];
  openBills: Opt[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openForm, setOpenForm] = useState<{ id: string; kind: string } | null>(null);
  const [field, setField] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState<{ id: string; msg: string } | null>(null);

  async function act(lineId: string, body: any) {
    setBusyId(lineId);
    setError(null);
    const res = await fetch(`/api/reconcile/lines/${lineId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setBusyId(null);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError({ id: lineId, msg: b?.message ?? b?.error?.formErrors?.[0] ?? 'Could not save' });
      return;
    }
    setOpenForm(null);
    setField('');
    setText('');
    router.refresh();
  }

  function form(l: RecLine) {
    if (!openForm || openForm.id !== l.id) return null;
    const k = openForm.kind;
    const pick = (opts: Opt[], placeholder: string) => (
      <select className="input h-9 py-1 text-sm" value={field} onChange={(e) => setField(e.target.value)}>
        <option value="">{placeholder}</option>
        {opts.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    );
    const sameAmount = (opts: Opt[]) =>
      [...opts].sort((a, b) => Number(Math.abs((a.amount ?? 0) - Math.abs(l.amount)) > 0.005) - Number(Math.abs((b.amount ?? 0) - Math.abs(l.amount)) > 0.005));
    const go = (body: any) => (
      <button type="button" className="btn-primary h-9 py-1 text-sm" disabled={busyId === l.id || !field} onClick={() => act(l.id, body)}>
        {busyId === l.id ? 'Saving…' : 'Save'}
      </button>
    );
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-2">
        {k === 'expense' && (
          <>
            {pick(expenseAccounts, 'Expense account…')}
            <input className="input h-9 py-1 text-sm" placeholder="Description (optional)" value={text} onChange={(e) => setText(e.target.value)} />
            {go({ action: 'expense', accountId: field, description: text || undefined })}
          </>
        )}
        {k === 'payment' && (
          <>
            {pick(sameAmount(openInvoices), 'Open invoice…')}
            {go({ action: 'payment', invoiceId: field })}
          </>
        )}
        {k === 'bill-payment' && (
          <>
            {pick(sameAmount(openBills), 'Open bill…')}
            {go({ action: 'bill-payment', billId: field })}
          </>
        )}
        {k === 'transfer' && (
          <>
            {pick(otherAccounts, l.amount > 0 ? 'Came from account…' : 'Went to account…')}
            <input className="input h-9 py-1 text-sm" placeholder="Memo (optional)" value={text} onChange={(e) => setText(e.target.value)} />
            {go({ action: 'transfer', accountId: field, memo: text || undefined })}
          </>
        )}
        {k === 'journal' && (
          <>
            {pick(otherAccounts.concat(expenseAccounts), 'Post against account…')}
            <input className="input h-9 py-1 text-sm" placeholder="Memo (optional)" value={text} onChange={(e) => setText(e.target.value)} />
            {go({ action: 'journal', accountId: field, memo: text || undefined })}
          </>
        )}
        {k === 'exclude' && (
          <>
            <input className="input h-9 py-1 text-sm" placeholder="Reason (e.g. duplicate line)" value={text} onChange={(e) => setText(e.target.value)} />
            <button type="button" className="btn-secondary h-9 py-1 text-sm" disabled={busyId === l.id} onClick={() => act(l.id, { action: 'exclude', note: text || undefined })}>
              Exclude
            </button>
          </>
        )}
        <button type="button" className="text-xs text-slate-500 hover:underline" onClick={() => setOpenForm(null)}>
          Cancel
        </button>
      </div>
    );
  }

  const menu = (l: RecLine) => {
    const items: [string, string][] =
      l.amount > 0
        ? [
            ['payment', 'Customer paid an invoice'],
            ['transfer', 'Transfer from another account'],
            ['journal', 'Other (post to an account)'],
            ['exclude', 'Exclude'],
          ]
        : [
            ['expense', 'Expense / bank charge'],
            ['bill-payment', 'Paid a supplier bill'],
            ['transfer', 'Transfer to another account'],
            ['journal', 'Other (post to an account)'],
            ['exclude', 'Exclude'],
          ];
    return (
      <select
        className="input h-8 w-auto py-0 text-xs"
        value=""
        onChange={(e) => {
          setField('');
          setText('');
          setOpenForm({ id: l.id, kind: e.target.value });
        }}
      >
        <option value="">Record as…</option>
        {items.map(([k, label]) => (
          <option key={k} value={k}>
            {label}
          </option>
        ))}
      </select>
    );
  };

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
          <th className="px-4 py-2">Date</th>
          <th className="px-4 py-2">Statement line</th>
          <th className="px-4 py-2 text-right">In</th>
          <th className="px-4 py-2 text-right">Out</th>
          <th className="px-4 py-2">In the books</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((l) => (
          <tr key={l.id} className={`border-b border-slate-50 align-top ${l.status === 'excluded' ? 'opacity-50' : ''}`}>
            <td className="whitespace-nowrap px-4 py-2 text-slate-500">{l.date}</td>
            <td className="px-4 py-2">
              {l.description}
              {l.reference && <span className="ml-1 text-xs text-slate-400">({l.reference})</span>}
              {l.balance != null && <span className="block text-xs text-slate-400">Balance {fmt(l.balance)}</span>}
            </td>
            <td className="whitespace-nowrap px-4 py-2 text-right text-emerald-700">{l.amount > 0 ? fmt(l.amount) : ''}</td>
            <td className="whitespace-nowrap px-4 py-2 text-right text-red-600">{l.amount < 0 ? fmt(-l.amount) : ''}</td>
            <td className="min-w-[18rem] px-4 py-2">
              {l.status === 'matched' && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`badge ${l.matchMissing ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {l.matchMissing ? 'Linked entry was deleted' : '✓ Matched'}
                  </span>
                  <span className="text-xs text-slate-600">{l.matchLabel}</span>
                  <button type="button" className="text-xs text-slate-400 hover:text-red-600 hover:underline" disabled={busyId === l.id} onClick={() => act(l.id, { action: 'unmatch' })}>
                    Unmatch
                  </button>
                </div>
              )}
              {l.status === 'excluded' && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="badge bg-slate-100 text-slate-600">Excluded</span>
                  {l.note && <span className="text-xs text-slate-500">{l.note}</span>}
                  <button type="button" className="text-xs text-brand-600 hover:underline" disabled={busyId === l.id} onClick={() => act(l.id, { action: 'include' })}>
                    Include again
                  </button>
                </div>
              )}
              {l.status === 'open' && (
                <div className="space-y-1.5">
                  {l.candidates.map((c) => (
                    <div key={`${c.type}:${c.id}`} className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className={`rounded-md px-2 py-0.5 text-xs font-medium ${c.mode === 'match' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-amber-500 text-white hover:bg-amber-600'}`}
                        disabled={busyId === l.id}
                        onClick={() => act(l.id, { action: 'match', type: c.type, id: c.id })}
                      >
                        {c.mode === 'match' ? 'Match' : `Move from ${c.bankName} & match`}
                      </button>
                      <span className="text-xs text-slate-600">
                        {c.label} · {c.date}
                      </span>
                    </div>
                  ))}
                  {l.candidates.length === 0 && <p className="text-xs text-slate-400">No matching entry found.</p>}
                  {menu(l)}
                  {form(l)}
                </div>
              )}
              {error?.id === l.id && <p className="mt-1 text-xs text-red-600">{error.msg}</p>}
            </td>
          </tr>
        ))}
        {lines.length === 0 && (
          <tr>
            <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
              Nothing here.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
