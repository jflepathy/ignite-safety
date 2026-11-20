'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Admin-only: move a payment to the right bank / cash account, or reverse it. */
export default function PaymentAdminActions({
  invoiceId,
  paymentId,
  bankAccountId,
  bankAccounts,
}: {
  invoiceId: string;
  paymentId: string;
  bankAccountId: string | null;
  bankAccounts: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<'idle' | 'move' | 'reverse'>('idle');
  const [target, setTarget] = useState(bankAccountId ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function call(method: 'PATCH' | 'DELETE', body?: any) {
    setBusy(true);
    setError('');
    const res = await fetch(`/api/invoices/${invoiceId}/payments/${paymentId}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    setBusy(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b?.message ?? b?.error?.formErrors?.[0] ?? 'Could not save');
      return;
    }
    setMode('idle');
    router.refresh();
  }

  if (mode === 'move')
    return (
      <span className="inline-flex flex-wrap items-center gap-2 text-xs">
        <select className="input h-8 py-0 text-xs" value={target} onChange={(e) => setTarget(e.target.value)}>
          {bankAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <button type="button" className="font-medium text-brand-600 hover:underline" disabled={busy || !target || target === bankAccountId} onClick={() => call('PATCH', { bankAccountId: target })}>
          {busy ? 'Saving…' : 'Move'}
        </button>
        <button type="button" className="text-slate-500 hover:underline" onClick={() => setMode('idle')}>
          Cancel
        </button>
        {error && <span className="text-red-600">{error}</span>}
      </span>
    );
  if (mode === 'reverse')
    return (
      <span className="inline-flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-600">Reverse this payment? The invoice balance re-opens.</span>
        <button type="button" className="font-medium text-red-600 hover:underline" disabled={busy} onClick={() => call('DELETE')}>
          {busy ? 'Reversing…' : 'Yes, reverse'}
        </button>
        <button type="button" className="text-slate-500 hover:underline" onClick={() => setMode('idle')}>
          Cancel
        </button>
        {error && <span className="text-red-600">{error}</span>}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-3 text-xs">
      <button type="button" className="text-brand-600 hover:underline" onClick={() => setMode('move')}>
        Change account
      </button>
      <button type="button" className="text-slate-500 hover:text-red-600 hover:underline" onClick={() => setMode('reverse')}>
        Reverse
      </button>
    </span>
  );
}
