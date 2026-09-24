'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Session 22, round 10 — generic admin-only "move to Recycle Bin" button.
 * Calls DELETE on the given API route (every soft-deletable model's DELETE
 * handler just sets `deletedAt`, never a hard delete/cascade), then either
 * redirects away (for a detail page whose record just disappeared from
 * every list) or refreshes in place (for a table row that vanishes from
 * the current page). Restoring happens from Settings > Recycle Bin.
 */
export default function DeleteRecordButton({
  apiUrl,
  recordLabel,
  redirectTo,
  className = 'btn-secondary text-xs text-red-600 hover:bg-red-50',
  label = 'Delete',
}: {
  apiUrl: string;
  recordLabel: string;
  redirectTo?: string;
  className?: string;
  label?: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function confirm() {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(apiUrl, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not delete this record.');
      if (redirectTo) {
        router.push(redirectTo);
        router.refresh();
      } else {
        setConfirming(false);
        router.refresh();
      }
    } catch (e: any) {
      setError(e.message);
      setSaving(false);
    }
  }

  return (
    <div className="inline-block">
      <button type="button" className={className} onClick={() => setConfirming(true)}>
        {label}
      </button>

      {confirming && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-ink-900">Delete {recordLabel}?</h2>
            <p className="text-sm text-slate-600">
              It moves to the Recycle Bin (Settings &gt; Recycle Bin), where an admin can restore it. Nothing is
              permanently deleted.
            </p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" disabled={saving} onClick={() => setConfirming(false)}>
                Cancel
              </button>
              <button type="button" className="btn-primary bg-red-600 hover:bg-red-700" disabled={saving} onClick={confirm}>
                {saving ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
