'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RecordPaymentForm({
  invoiceId,
  balanceDue,
  currency,
  allowedMethods,
}: {
  invoiceId: string;
  balanceDue: number;
  currency: string;
  allowedMethods: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(balanceDue);
  const [method, setMethod] = useState(allowedMethods[0] ?? 'CASH');
  const [reference, setReference] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, method, reference }),
      });
      if (!res.ok) throw new Error('Failed to record payment');
      setOpen(false);
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (balanceDue <= 0) return null;

  if (!open) {
    return (
      <button className="btn-primary" onClick={() => setOpen(true)}>
        Record Payment
      </button>
    );
  }

  return (
    <div className="card w-80 space-y-3 p-4">
      <h3 className="text-sm font-semibold">Record Payment</h3>
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
          {allowedMethods.map((m) => (
            <option key={m} value={m}>
              {m.replace('_', ' ')}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Reference (optional)</label>
        <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button className="btn-secondary" onClick={() => setOpen(false)}>
          Cancel
        </button>
        <button className="btn-primary" disabled={submitting} onClick={submit}>
          {submitting ? 'Saving…' : 'Save Payment'}
        </button>
      </div>
    </div>
  );
}
