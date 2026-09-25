'use client';

import { useMemo, useState } from 'react';
import { formatMoney } from '@/lib/money';
import { formatDate } from '@/lib/format-date';

type Account = { id: string; code: string | null; name: string; type: string };
type Row = { id: string; date: string; description: string; vendor: string; reference: string; amount: string };

function AccountOption({ a }: { a: Account }) {
  return (
    <option value={a.id}>
      {a.code ? `${a.code} — ` : ''}
      {a.name}
    </option>
  );
}

export default function ReclassifyClient({
  accounts,
  canEdit,
  currency,
}: {
  accounts: Account[];
  canEdit: boolean;
  currency: string;
}) {
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [expenses, setExpenses] = useState<Row[]>([]);
  const [billLineItems, setBillLineItems] = useState<Row[]>([]);
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<Set<string>>(new Set());
  const [selectedLineItemIds, setSelectedLineItemIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState('');

  async function loadTransactions() {
    if (!fromAccountId) return;
    setLoading(true);
    setError('');
    setResult('');
    try {
      const params = new URLSearchParams({ fromAccountId });
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      const res = await fetch(`/api/accounting/reclassify?${params}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not load transactions.');
      setExpenses(data.expenses);
      setBillLineItems(data.billLineItems);
      setSelectedExpenseIds(new Set());
      setSelectedLineItemIds(new Set());
      setLoaded(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function toggle(set: Set<string>, setSet: (s: Set<string>) => void, id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSet(next);
  }

  const selectedCount = selectedExpenseIds.size + selectedLineItemIds.size;
  const toAccountOptions = useMemo(() => accounts.filter((a) => a.id !== fromAccountId), [accounts, fromAccountId]);

  async function submit() {
    if (!fromAccountId || !toAccountId || selectedCount === 0) return;
    setSaving(true);
    setError('');
    setResult('');
    try {
      const res = await fetch('/api/accounting/reclassify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromAccountId,
          toAccountId,
          expenseIds: Array.from(selectedExpenseIds),
          billLineItemIds: Array.from(selectedLineItemIds),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not reclassify these transactions.');
      // loadTransactions() clears `result` as soon as it starts (it's also
      // called on its own, from the "Find Transactions" button, where any
      // stale success message should disappear) — so the success message
      // has to be set AFTER the reload finishes, not before, or it gets
      // wiped out before it's ever shown.
      await loadTransactions();
      setResult(
        `Moved ${data.expensesMoved} expense${data.expensesMoved === 1 ? '' : 's'} and ${data.billLineItemsMoved} bill line item${data.billLineItemsMoved === 1 ? '' : 's'}.`
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (!canEdit) {
    return (
      <div className="card p-6 text-sm text-slate-500">
        You don't have edit access to Chart of Accounts, so you can't reclassify transactions. Ask an admin to grant
        you access in Settings &gt; Users if you need it.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card flex flex-wrap items-end gap-4 p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">From account</label>
          <select
            className="input"
            value={fromAccountId}
            onChange={(e) => {
              setFromAccountId(e.target.value);
              setLoaded(false);
            }}
          >
            <option value="">— Select —</option>
            {accounts.map((a) => (
              <AccountOption key={a.id} a={a} />
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">From date</label>
          <input type="date" className="input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">To date</label>
          <input type="date" className="input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <button type="button" className="btn-secondary" disabled={!fromAccountId || loading} onClick={loadTransactions}>
          {loading ? 'Loading…' : 'Find Transactions'}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {result && <p className="text-sm text-emerald-600">{result}</p>}

      {loaded && (
        <>
          {expenses.length === 0 && billLineItems.length === 0 ? (
            <div className="card p-6 text-center text-sm text-slate-400">
              No expenses or bill line items are currently coded to this account{dateFrom || dateTo ? ' in that date range' : ''}.
            </div>
          ) : (
            <>
              {expenses.length > 0 && (
                <div className="card overflow-x-auto">
                  <div className="border-b border-slate-100 px-4 py-3">
                    <h2 className="text-sm font-semibold text-ink-900">Expenses ({expenses.length})</h2>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
                        <th className="px-4 py-2"></th>
                        <th className="px-4 py-2">Date</th>
                        <th className="px-4 py-2">Reference</th>
                        <th className="px-4 py-2">Vendor</th>
                        <th className="px-4 py-2">Description</th>
                        <th className="px-4 py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenses.map((r) => (
                        <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="px-4 py-2">
                            <input
                              type="checkbox"
                              checked={selectedExpenseIds.has(r.id)}
                              onChange={() => toggle(selectedExpenseIds, setSelectedExpenseIds, r.id)}
                            />
                          </td>
                          <td className="px-4 py-2 text-slate-500">{formatDate(r.date)}</td>
                          <td className="px-4 py-2 text-slate-500">{r.reference}</td>
                          <td className="px-4 py-2 text-slate-500">{r.vendor}</td>
                          <td className="px-4 py-2 text-ink-900">{r.description}</td>
                          <td className="px-4 py-2 text-right font-medium text-ink-900">{formatMoney(r.amount, currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {billLineItems.length > 0 && (
                <div className="card overflow-x-auto">
                  <div className="border-b border-slate-100 px-4 py-3">
                    <h2 className="text-sm font-semibold text-ink-900">Bill Line Items ({billLineItems.length})</h2>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
                        <th className="px-4 py-2"></th>
                        <th className="px-4 py-2">Date</th>
                        <th className="px-4 py-2">Bill #</th>
                        <th className="px-4 py-2">Supplier</th>
                        <th className="px-4 py-2">Description</th>
                        <th className="px-4 py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {billLineItems.map((r) => (
                        <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="px-4 py-2">
                            <input
                              type="checkbox"
                              checked={selectedLineItemIds.has(r.id)}
                              onChange={() => toggle(selectedLineItemIds, setSelectedLineItemIds, r.id)}
                            />
                          </td>
                          <td className="px-4 py-2 text-slate-500">{formatDate(r.date)}</td>
                          <td className="px-4 py-2 text-slate-500">{r.reference}</td>
                          <td className="px-4 py-2 text-slate-500">{r.vendor}</td>
                          <td className="px-4 py-2 text-ink-900">{r.description}</td>
                          <td className="px-4 py-2 text-right font-medium text-ink-900">{formatMoney(r.amount, currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="card flex flex-wrap items-end gap-4 p-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">To account</label>
                  <select className="input" value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
                    <option value="">— Select —</option>
                    {toAccountOptions.map((a) => (
                      <AccountOption key={a.id} a={a} />
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={!toAccountId || selectedCount === 0 || saving}
                  onClick={submit}
                >
                  {saving ? 'Moving…' : `Move ${selectedCount || ''} Selected Transaction${selectedCount === 1 ? '' : 's'}`}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
