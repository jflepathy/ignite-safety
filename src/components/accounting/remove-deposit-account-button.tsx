'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Reverses "Enable for Deposits" (Session 22, round 4) — removes an Asset
 * account from every "Deposit To" picker in the app by deleting its
 * BankAccount link. The server refuses (with a plain-language reason) if
 * the account has any recorded payments/deposits/bank transactions
 * against it, so this can't silently orphan real financial history — see
 * the DELETE handler in api/accounts/[id]/bank-account/route.ts.
 */
export default function RemoveDepositAccountButton({ accountId, accountName }: { accountId: string; accountName: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function confirm() {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/accounts/${accountId}/bank-account`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not remove this account from deposits.');
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
      <button type="button" className="btn-secondary text-xs" onClick={() => setConfirming(true)}>
        Remove from Deposits
      </button>

      {confirming && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-ink-900">Remove &quot;{accountName}&quot; from Deposits?</h2>
            <p className="text-sm text-slate-600">
              It will no longer appear in the Deposit To list on Record Payment, the Deposit form, or Reconcile. The
              account itself stays in the Chart of Accounts — only its deposit-account link is removed.
            </p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" disabled={saving} onClick={() => setConfirming(false)}>
                Cancel
              </button>
              <button type="button" className="btn-primary" disabled={saving} onClick={confirm}>
                {saving ? 'Removing…' : 'Yes, Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
