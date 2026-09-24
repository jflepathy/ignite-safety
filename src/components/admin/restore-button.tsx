'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type RecycleType = 'customer' | 'supplier' | 'equipment' | 'estimate' | 'invoice' | 'workOrder';

/** Session 22, round 10 — restores one Recycle Bin row via POST
 * /api/admin/recycle-bin/restore, then refreshes the (server-rendered)
 * list so the row drops out immediately. */
export default function RestoreButton({ type, id, label }: { type: RecycleType; id: string; label: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function restore() {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/admin/recycle-bin/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not restore this record.');
      router.refresh();
    } catch (e: any) {
      setError(e.message);
      setSaving(false);
    }
  }

  return (
    <div className="inline-flex items-center gap-2">
      {error && <span className="text-xs text-red-600">{error}</span>}
      <button type="button" className="btn-secondary text-xs" disabled={saving} onClick={restore} title={`Restore ${label}`}>
        {saving ? 'Restoring…' : 'Restore'}
      </button>
    </div>
  );
}
