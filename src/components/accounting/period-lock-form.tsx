'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PeriodLockForm({ closedThrough, suggestion }: { closedThrough: string | null; suggestion: string }) {
  const router = useRouter();
  const [date, setDate] = useState(closedThrough ?? suggestion);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmReopen, setConfirmReopen] = useState(false);

  async function save(value: string | null) {
    setBusy(true);
    setError('');
    const res = await fetch('/api/accounting/period-lock', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ closedThrough: value }),
    });
    setBusy(false);
    if (!res.ok) return setError('Could not save.');
    setConfirmReopen(false);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        {closedThrough ? (
          <>
            Books are <span className="font-semibold text-ink-900">closed through {closedThrough.split('-').reverse().join('/')}</span>. Nothing dated on or
            before that day can be added, edited or deleted.
          </>
        ) : (
          'Books are open. Close a period once its figures are final (for example after filing), so they can’t change by accident.'
        )}
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Close books through</label>
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <button type="button" className="btn-primary" disabled={busy || !date || date === closedThrough} onClick={() => save(date)}>
          {busy ? 'Saving…' : 'Close books'}
        </button>
        {closedThrough &&
          (confirmReopen ? (
            <span className="flex items-center gap-2 text-sm">
              <span className="text-slate-600">Reopen all periods?</span>
              <button type="button" className="font-medium text-red-600 hover:underline" disabled={busy} onClick={() => save(null)}>
                Yes, reopen
              </button>
              <button type="button" className="text-slate-500 hover:underline" onClick={() => setConfirmReopen(false)}>
                Cancel
              </button>
            </span>
          ) : (
            <button type="button" className="btn-secondary" onClick={() => setConfirmReopen(true)}>
              Reopen
            </button>
          ))}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
