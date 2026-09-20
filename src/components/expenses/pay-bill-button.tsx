'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const METHODS = ['CASH', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'OTHER'];

export default function PayBillButton({ billId, maxAmount, currency }: { billId: string; maxAmount: number; currency: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(maxAmount);
  const [method, setMethod] = useState('BANK_TRANSFER');
  const [reference, setReference] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/bills/${billId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, method, reference: reference || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ? JSON.stringify(body.error) : 'Failed to record payment');
      }
      setOpen(false);
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button className="btn-secondary" onClick={() => setOpen(true)}>
        Pay
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
      <div className="w-full max-w-sm space-y-3 rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-ink-900">Pay Bill</h2>
        <div>
          <label className="label">Amount ({currency})</label>
          <input
            type="number"
            step="0.01"
            className="input"
            value={amount}
            onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
          />
        </div>
        <div>
          <label className="label">Method</label>
          <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {m.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Reference</label>
          <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button className="btn-secondary" onClick={() => setOpen(false)}>
            Cancel
          </button>
          <button className="btn-primary" disabled={submitting || amount <= 0} onClick={submit}>
            {submitting ? 'Recording…' : 'Record Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}
