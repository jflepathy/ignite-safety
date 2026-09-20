'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type BankAccountOption = { id: string; name: string };

export default function DepositForm({ bankAccounts }: { bankAccounts: BankAccountOption[] }) {
  const router = useRouter();
  const [bankAccountId, setBankAccountId] = useState(bankAccounts[0]?.id ?? '');
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [memo, setMemo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/deposits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankAccountId, amount, date, memo: memo || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ? JSON.stringify(body.error) : 'Failed to save');
      }
      router.push('/accounting/deposits');
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
        <label className="label">Bank Account</label>
        <select className="input" value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)}>
          {bankAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Amount</label>
          <input
            type="number"
            step="0.01"
            className="input"
            value={amount}
            onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
          />
        </div>
        <div>
          <label className="label">Date</label>
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="label">Memo</label>
        <textarea className="input" rows={3} value={memo} onChange={(e) => setMemo(e.target.value)} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end">
        <button className="btn-primary" disabled={submitting || !bankAccountId || amount <= 0} onClick={submit}>
          {submitting ? 'Saving…' : 'Save Deposit'}
        </button>
      </div>
    </div>
  );
}
