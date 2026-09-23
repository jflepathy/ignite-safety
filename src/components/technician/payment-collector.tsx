'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { amountInWords, formatMoney } from '@/lib/money';

type Method = 'CASH' | 'CHEQUE' | 'BANK_TRANSFER';

/** The technician billing-bridge's "Receiving Payment" step (Session 16).
 * Cash confirms on the spot. Cheque/Transfer show what the client needs
 * (payee + amount in words, or bank details + amount) and then capture a
 * photo of the cheque / transfer confirmation, which the server either
 * auto-verifies with AI or leaves for an admin to confirm by hand. */
export default function PaymentCollector({
  invoiceId,
  invoiceNumber,
  amountDue,
  currency,
  payeeName,
  bankName,
  bankAccountName,
  bankAccountNumber,
}: {
  invoiceId: string;
  invoiceNumber: string;
  amountDue: number;
  currency: string;
  payeeName: string;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
}) {
  const router = useRouter();
  const [method, setMethod] = useState<Method | null>(null);
  const [amount, setAmount] = useState(amountDue);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ verificationStatus: string } | null>(null);

  async function handleFile(file: File) {
    if (file.size > 8 * 1024 * 1024) {
      setError('That photo is too large — please retake it at a lower resolution.');
      return;
    }
    setError('');
    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    setPhotoDataUrl(dataUrl);
    setPhotoName(file.name);
  }

  async function submit() {
    if (!method) return;
    if (method !== 'CASH' && !photoDataUrl) {
      setError('Please take a photo of the cheque / transfer confirmation first.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/technician-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, method, photoDataUrl: photoDataUrl ?? undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.formErrors?.[0] ?? 'Failed to record payment');
      }
      const body = await res.json();
      setResult({ verificationStatus: body.payment.verificationStatus });
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    const status = result.verificationStatus;
    return (
      <div className="space-y-4">
        <div className={`rounded-xl border p-5 text-center ${status === 'CONFIRMED' ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
          {status === 'CONFIRMED' ? (
            <>
              <p className="text-2xl">✓</p>
              <p className="mt-1 font-semibold text-emerald-800">Payment confirmed</p>
              <p className="mt-1 text-sm text-emerald-700">The invoice is marked Paid. You can send the client their copy now.</p>
            </>
          ) : status === 'MISMATCH' ? (
            <>
              <p className="text-2xl">⚠️</p>
              <p className="mt-1 font-semibold text-amber-800">Flagged for review</p>
              <p className="mt-1 text-sm text-amber-700">The photo didn't clearly match — office will review and confirm.</p>
            </>
          ) : (
            <>
              <p className="text-2xl">🕒</p>
              <p className="mt-1 font-semibold text-amber-800">Submitted — pending review</p>
              <p className="mt-1 text-sm text-amber-700">Office will confirm this payment shortly.</p>
            </>
          )}
        </div>
        <a href={`/technician/invoice/${invoiceId}`} className="btn-primary block w-full py-3 text-center text-base">
          Back to Invoice
        </a>
      </div>
    );
  }

  if (!method) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-500">
          Amount due: <span className="font-semibold text-ink-900">{formatMoney(amountDue, currency)}</span>
        </p>
        <button className="btn-secondary block w-full py-3 text-base" onClick={() => setMethod('CASH')}>
          💵 Cash
        </button>
        <button className="btn-secondary block w-full py-3 text-base" onClick={() => setMethod('CHEQUE')}>
          🧾 Cheque
        </button>
        <button className="btn-secondary block w-full py-3 text-base" onClick={() => setMethod('BANK_TRANSFER')}>
          🏦 Bank Transfer
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Amount received ({currency})</label>
        <input
          type="number"
          step="0.01"
          className="input"
          value={amount}
          onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
        />
      </div>

      {method === 'CHEQUE' && (
        <div className="space-y-1.5 rounded-lg bg-slate-50 p-4 text-sm">
          <p className="text-slate-500">Have the client make the cheque out to:</p>
          <p className="font-semibold text-ink-900">{payeeName}</p>
          <p className="text-slate-500">Amount in figures:</p>
          <p className="font-semibold text-ink-900">{formatMoney(amount, currency)}</p>
          <p className="text-slate-500">Amount in words:</p>
          <p className="font-semibold text-ink-900">{amountInWords(amount, currency)}</p>
        </div>
      )}

      {method === 'BANK_TRANSFER' && (
        <div className="space-y-1.5 rounded-lg bg-slate-50 p-4 text-sm">
          <p className="text-slate-500">Have the client transfer to:</p>
          <p className="font-semibold text-ink-900">{bankName ?? '—'}</p>
          <p className="text-slate-500">Account name:</p>
          <p className="font-semibold text-ink-900">{bankAccountName ?? '—'}</p>
          <p className="text-slate-500">Account number:</p>
          <p className="font-semibold text-ink-900">{bankAccountNumber ?? '—'}</p>
          <p className="text-slate-500">Amount:</p>
          <p className="font-semibold text-ink-900">{formatMoney(amount, currency)}</p>
        </div>
      )}

      {(method === 'CHEQUE' || method === 'BANK_TRANSFER') && (
        <div>
          <label className="label">Photo of {method === 'CHEQUE' ? 'the cheque' : 'the transfer confirmation'}</label>
          <label className="btn-secondary block cursor-pointer py-3 text-center">
            {photoName ? `📷 ${photoName} — retake` : '📷 Take / Upload Photo'}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = '';
              }}
            />
          </label>
          {photoDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoDataUrl} alt="Payment proof" className="mt-2 max-h-64 w-full rounded-lg object-contain" />
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button className="btn-secondary flex-1 py-3" onClick={() => setMethod(null)} disabled={submitting}>
          Back
        </button>
        <button className="btn-primary flex-1 py-3" onClick={submit} disabled={submitting}>
          {submitting ? 'Submitting…' : method === 'CASH' ? 'Confirm Cash Received' : 'Submit'}
        </button>
      </div>
    </div>
  );
}
