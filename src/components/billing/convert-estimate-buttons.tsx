'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Session 22, round 15 — lets an Estimate become either a draft Invoice
 * (the existing POST /api/estimates/[id]/convert route, which previously
 * had no UI button anywhere in the app) or a fully-paid Sales Receipt (a
 * new sibling route, for the on-the-spot-payment case). Hidden once the
 * estimate is already CONVERTED — an estimate can only ever be converted
 * once, matching both API routes' own 409 guard.
 */
export default function ConvertEstimateButtons({
  estimateId,
  currency,
}: {
  estimateId: string;
  currency: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<null | 'invoice' | 'receipt'>(null);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function confirmInvoice() {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/estimates/${estimateId}/convert`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not convert this estimate to an invoice.');
      router.push(`/billing/invoices/${data.id}`);
    } catch (e: any) {
      setError(e.message);
      setSaving(false);
    }
  }

  async function confirmReceipt() {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/estimates/${estimateId}/convert-to-sales-receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethod }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not convert this estimate to a sales receipt.');
      router.push(`/billing/sales-receipts/${data.id}`);
    } catch (e: any) {
      setError(e.message);
      setSaving(false);
    }
  }

  return (
    <div className="inline-flex items-center gap-2">
      <button type="button" className="btn-secondary" onClick={() => setMode('invoice')}>
        Convert to Invoice
      </button>
      <button type="button" className="btn-secondary" onClick={() => setMode('receipt')}>
        Convert to Sales Receipt
      </button>

      {mode === 'invoice' && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-ink-900">Convert to Invoice?</h2>
            <p className="text-sm text-slate-600">
              Creates a new draft invoice with the same customer and line items. The estimate is marked Converted
              and can&apos;t be edited or converted again.
            </p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" disabled={saving} onClick={() => setMode(null)}>
                Cancel
              </button>
              <button type="button" className="btn-primary" disabled={saving} onClick={confirmInvoice}>
                {saving ? 'Converting…' : 'Yes, Create Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}

      {mode === 'receipt' && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-ink-900">Convert to Sales Receipt?</h2>
            <p className="text-sm text-slate-600">
              Records this as a fully paid sale right now ({currency}) — unlike an invoice, a sales receipt carries
              no outstanding balance. The estimate is marked Converted and can&apos;t be edited or converted again.
            </p>
            <div>
              <label className="label">How was it paid?</label>
              <select className="input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                <option value="CASH">Cash</option>
                <option value="CARD">Card</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CHEQUE">Cheque</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" disabled={saving} onClick={() => setMode(null)}>
                Cancel
              </button>
              <button type="button" className="btn-primary" disabled={saving} onClick={confirmReceipt}>
                {saving ? 'Converting…' : 'Yes, Create Sales Receipt'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
