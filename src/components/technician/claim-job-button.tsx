'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Lets a technician explicitly claim an open job — unassigned, or stale
 * (assigned to someone else but idle 4+ days) — right from the job list,
 * without having to open it first. A confirmation step makes sure they
 * mean to take it before it's assigned to them (Session 12).
 */
export default function ClaimJobButton({
  workOrderId,
  technicianId,
  woNumber,
  customerName,
}: {
  workOrderId: string;
  technicianId: string;
  woNumber: string;
  customerName: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState('');

  async function claim(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setClaiming(true);
    setError('');
    try {
      const res = await fetch(`/api/work-orders/${workOrderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedTechnicianId: technicianId, status: 'IN_PROGRESS' }),
      });
      if (!res.ok) throw new Error('Could not claim this job — it may have just been claimed by someone else.');
      router.push(`/technician/${workOrderId}`);
      router.refresh();
    } catch (e: any) {
      setError(e.message);
      setClaiming(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        className="btn-primary w-full py-2 text-sm"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setConfirming(true);
        }}
      >
        ✋ Claim This Job
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      {confirming && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-ink-900">Claim {woNumber}?</h2>
            <p className="text-sm text-slate-600">
              This assigns <strong>{customerName}</strong>&apos;s job to you and marks it In Progress. Once claimed, other technicians
              won&apos;t see it in their job list.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn-secondary"
                disabled={claiming}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setConfirming(false);
                }}
              >
                Cancel
              </button>
              <button type="button" className="btn-primary" disabled={claiming} onClick={claim}>
                {claiming ? 'Claiming…' : 'Yes, Claim It'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
