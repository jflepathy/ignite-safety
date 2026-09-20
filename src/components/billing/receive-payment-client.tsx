'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatMoney } from '@/lib/money';

type OpenInvoice = {
  id: string;
  invoiceNumber: string;
  customerName: string;
  total: number;
  balanceDue: number;
};

const METHODS = ['CASH', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'OTHER'];

export default function ReceivePaymentClient({ invoices, currency }: { invoices: OpenInvoice[]; currency: string }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState('BANK_TRANSFER');
  const [reference, setReference] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const filtered = useMemo(
    () =>
      invoices.filter(
        (i) => !q || i.invoiceNumber.toLowerCase().includes(q.toLowerCase()) || i.customerName.toLowerCase().includes(q.toLowerCase())
      ),
    [invoices, q]
  );

  const selected = invoices.find((i) => i.id === invoiceId);

  function selectInvoice(inv: OpenInvoice) {
    setInvoiceId(inv.id);
    setAmount(inv.balanceDue);
    setSuccess('');
    setError('');
  }

  async function submit() {
    if (!selected) return;
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`/api/invoices/${selected.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, method, reference: reference || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ? JSON.stringify(body.error) : 'Failed to record payment');
      }
      setSuccess(`Payment of ${formatMoney(amount, currency)} recorded against ${selected.invoiceNumber}.`);
      setInvoiceId('');
      setAmount(0);
      setReference('');
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <div className="card overflow-hidden lg:col-span-3">
        <div className="border-b border-slate-100 p-4">
          <input
            className="input"
            placeholder="Search by invoice # or customer…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Invoice #</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Balance Due</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((i) => (
              <tr
                key={i.id}
                onClick={() => selectInvoice(i)}
                className={`cursor-pointer border-b border-slate-50 hover:bg-slate-50 ${invoiceId === i.id ? 'bg-brand-50' : ''}`}
              >
                <td className="px-4 py-3 font-medium text-ink-900">{i.invoiceNumber}</td>
                <td className="px-4 py-3 text-slate-500">{i.customerName}</td>
                <td className="px-4 py-3 text-right">{formatMoney(i.total, currency)}</td>
                <td className="px-4 py-3 text-right font-medium">{formatMoney(i.balanceDue, currency)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-slate-400">
                  No open invoices match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card space-y-4 p-6 lg:col-span-2">
        <h2 className="text-sm font-semibold text-ink-900">Record Payment</h2>
        {selected ? (
          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            <p className="font-medium text-ink-900">{selected.invoiceNumber}</p>
            <p className="text-slate-500">{selected.customerName}</p>
            <p className="mt-1 text-slate-500">Balance due: {formatMoney(selected.balanceDue, currency)}</p>
          </div>
        ) : (
          <p className="text-sm text-slate-400">Select an invoice from the list.</p>
        )}
        <div>
          <label className="label">Amount ({currency})</label>
          <input
            type="number"
            step="0.01"
            className="input"
            disabled={!selected}
            value={amount}
            onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
          />
        </div>
        <div>
          <label className="label">Method</label>
          <select className="input" disabled={!selected} value={method} onChange={(e) => setMethod(e.target.value)}>
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {m.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Reference</label>
          <input className="input" disabled={!selected} value={reference} onChange={(e) => setReference(e.target.value)} />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-emerald-600">{success}</p>}
        <button className="btn-primary w-full" disabled={!selected || submitting || amount <= 0} onClick={submit}>
          {submitting ? 'Recording…' : 'Record Payment'}
        </button>
      </div>
    </div>
  );
}
