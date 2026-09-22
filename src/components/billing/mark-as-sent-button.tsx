'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * A DRAFT invoice had no way to become a confirmed/SENT invoice short of
 * re-opening Edit and re-saving (which doesn't even send `status` in its
 * payload — see InvoiceForm). This is the missing "confirm it" action:
 * a single PATCH that flips status to SENT, nothing else on the invoice
 * touched. Only rendered for DRAFT invoices (see invoice detail page).
 */
export default function MarkAsSentButton({ invoiceId, invoiceNumber }: { invoiceId: string; invoiceNumber: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function confirm() {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'SENT' }),
      });
      if (!res.ok) throw new Error('Could not mark this invoice as sent.');
      setConfirming(false);
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="inline-block">
      <button type="button" className="btn-primary" onClick={() => setConfirming(true)}>
        Mark as Sent
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      {confirming && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-ink-900">Mark {invoiceNumber} as Sent?</h2>
            <p className="text-sm text-slate-600">
              This confirms the invoice and changes its status from Draft to Sent. Nothing else on the invoice changes.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" disabled={saving} onClick={() => setConfirming(false)}>
                Cancel
              </button>
              <button type="button" className="btn-primary" disabled={saving} onClick={confirm}>
                {saving ? 'Saving…' : 'Yes, Mark as Sent'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
