'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Shown right after a technician completes & syncs a job (Session 16) —
 * asks whether to raise the invoice now, and offers going straight into
 * payment collection. Both options create the same auto-populated draft
 * invoice (from the job's serviceLines via the Incentive Rates mapping);
 * "Receiving Payment" just continues straight into the collection flow
 * afterward. Dismissable — nothing here is forced, the invoice can always
 * be raised later from the job or from Billing. */
export default function BillingBridgeModal({ workOrderId, onClose }: { workOrderId: string; onClose: () => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState<'invoice' | 'payment' | null>(null);
  const [error, setError] = useState('');

  async function go(next: 'invoice' | 'payment') {
    setLoading(next);
    setError('');
    try {
      const res = await fetch(`/api/work-orders/${workOrderId}/raise-invoice`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.formErrors?.[0] ?? 'Failed to raise the invoice');
      }
      const invoice = await res.json();
      router.push(next === 'invoice' ? `/technician/invoice/${invoice.id}` : `/technician/invoice/${invoice.id}/collect`);
    } catch (e: any) {
      setError(e.message);
      setLoading(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="w-full max-w-md space-y-4 rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl">
        <div className="text-center">
          <p className="text-2xl">✓</p>
          <h2 className="mt-1 text-lg font-semibold text-ink-900">Job completed!</h2>
          <p className="mt-1 text-sm text-slate-500">What would you like to do?</p>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn-primary block w-full py-3 text-base" disabled={!!loading} onClick={() => go('payment')}>
          {loading === 'payment' ? 'Preparing…' : '💵 Receiving Payment'}
        </button>
        <button className="btn-secondary block w-full py-3 text-base" disabled={!!loading} onClick={() => go('invoice')}>
          {loading === 'invoice' ? 'Preparing…' : '🧾 Raise Invoice Only'}
        </button>
        <button className="block w-full py-1 text-center text-sm text-slate-400" disabled={!!loading} onClick={onClose}>
          Not now
        </button>
      </div>
    </div>
  );
}
