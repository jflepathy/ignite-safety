'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type AccountOption = { id: string; name: string };

export default function TransferForm({ accounts }: { accounts: AccountOption[] }) {
  const router = useRouter();
  const [fromAccountId, setFromAccountId] = useState(accounts[0]?.id ?? '');
  const [toAccountId, setToAccountId] = useState(accounts[1]?.id ?? accounts[0]?.id ?? '');
  const [amount, setAmount] = useState(0);
  const [memo, setMemo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromAccountId, toAccountId, amount, memo: memo || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ? JSON.stringify(body.error) : 'Failed to save');
      }
      router.push('/accounting/transfers');
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card grid max-w-xl grid-cols-1 gap-4 p-6">
      <div>
        <label className="label">From Account</label>
        <select className="input" value={fromAccountId} onChange={(e) => setFromAccountId(e.target.value)}>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">To Account</label>
        <select className="input" value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Amount</label>
        <input type="number" step="0.01" className="input" value={amount} onChange={(e) => setAmount(parseFloat(e.target.value) || 0)} />
      </div>
      <div>
        <label className="label">Memo</label>
        <textarea className="input" rows={3} value={memo} onChange={(e) => setMemo(e.target.value)} />
      </div>
      {fromAccountId && toAccountId && fromAccountId === toAccountId && (
        <p className="text-sm text-red-600">From and To accounts must be different.</p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end">
        <button
          className="btn-primary"
          disabled={submitting || !fromAccountId || !toAccountId || fromAccountId === toAccountId || amount <= 0}
          onClick={submit}
        >
          {submitting ? 'Saving…' : 'Save Transfer'}
        </button>
      </div>
    </div>
  );
}
