'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

/** Lets the person narrow the Income vs. Expense and Sales Tax sections to
 * a date range instead of always showing all-time totals — the "editable"
 * part of "reports needs to be able to be printed and edited." (AR Aging
 * is a snapshot of what's outstanding right now, so it isn't affected by
 * this filter.) */
export default function ReportDateFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [from, setFrom] = useState(searchParams.get('from') ?? '');
  const [to, setTo] = useState(searchParams.get('to') ?? '');

  function apply() {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    router.push(`/billing/reports${params.toString() ? `?${params.toString()}` : ''}`);
  }

  function clear() {
    setFrom('');
    setTo('');
    router.push('/billing/reports');
  }

  return (
    <div className="card flex flex-wrap items-end gap-3 p-4 print:hidden">
      <div>
        <label className="label">From</label>
        <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
      </div>
      <div>
        <label className="label">To</label>
        <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      <button className="btn-primary" onClick={apply}>
        Apply
      </button>
      {(searchParams.get('from') || searchParams.get('to')) && (
        <button className="btn-secondary" onClick={clear}>
          Clear (show all-time)
        </button>
      )}
      <p className="w-full text-xs text-slate-400">Applies to Income vs. Expense and Sales Tax below. AR Aging always reflects what's outstanding right now.</p>
    </div>
  );
}
