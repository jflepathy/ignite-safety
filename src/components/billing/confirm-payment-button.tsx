'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Admin manual fallback for a technician-collected cheque/transfer
 * payment sitting at PENDING_REVIEW or MISMATCH (Session 16) — see
 * /api/invoices/[id]/payments/[paymentId]/confirm. Confirming here is
 * what actually moves the money onto the invoice's balance. */
export default function ConfirmPaymentButton({ invoiceId, paymentId }: { invoiceId: string; paymentId: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function confirm() {
    if (!window.confirm('Confirm this payment matches the proof photo and mark it as received?')) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/payments/${paymentId}/confirm`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.formErrors?.[0] ?? 'Failed to confirm');
      }
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <button className="text-xs font-medium text-emerald-600 hover:underline" disabled={saving} onClick={confirm}>
        {saving ? 'Confirming…' : 'Confirm payment'}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
