'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Session 22, round 11 — sends the invoice by email with a real PDF
 * attachment (via Resend — see api/invoices/[id]/email/route.ts and
 * lib/email.ts). Disabled with an explanatory title when the customer has
 * no email on file, so the reason is visible without a failed attempt.
 */
export default function EmailInvoiceButton({
  invoiceId,
  invoiceNumber,
  customerEmail,
}: {
  invoiceId: string;
  invoiceNumber: string;
  customerEmail: string | null;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function send() {
    setSending(true);
    setError('');
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/email`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not send this invoice.');
      setSent(true);
      router.refresh();
      setTimeout(() => setConfirming(false), 1200);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  if (!customerEmail) {
    return (
      <button type="button" className="btn-secondary" disabled title="This customer has no email address on file">
        ✉️ Email Invoice
      </button>
    );
  }

  return (
    <div className="inline-block">
      <button type="button" className="btn-secondary" onClick={() => { setConfirming(true); setSent(false); setError(''); }}>
        ✉️ Email Invoice
      </button>

      {confirming && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-ink-900">Email {invoiceNumber}?</h2>
            <p className="text-sm text-slate-600">
              Sends the invoice as a PDF attachment to <strong>{customerEmail}</strong>.
              {' '}If this invoice is still a Draft, it will also be marked as Sent.
            </p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {sent && <p className="text-sm text-emerald-600">Sent.</p>}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" disabled={sending} onClick={() => setConfirming(false)}>
                Cancel
              </button>
              <button type="button" className="btn-primary" disabled={sending || sent} onClick={send}>
                {sending ? 'Sending…' : sent ? 'Sent ✓' : 'Yes, Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
