'use client';

import { useMemo, useState } from 'react';
import { formatDate } from '@/lib/format-date';
import type { BatchClient, BatchHistory } from '@/lib/servicing-batches';

const SOURCE_LABEL: Record<string, string> = {
  QUICKBOOKS: 'QuickBooks',
  PRESAFE_2021: 'Presafe 2021',
  PRESAFE_2023: 'Presafe 2023',
  APP: 'Ignite app',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function monthLabel(iso: string) {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function batchSummary(b: BatchHistory) {
  const parts: string[] = [];
  if (b.extinguishers) parts.push(`${b.extinguishers} F/Ext`);
  if (b.hoseReels) parts.push(`${b.hoseReels} Hose Reel${b.hoseReels > 1 ? 's' : ''}`);
  if (b.fireBlankets) parts.push(`${b.fireBlankets} Blanket${b.fireBlankets > 1 ? 's' : ''}`);
  if (b.detectors) parts.push(`${b.detectors} Detector${b.detectors > 1 ? 's' : ''}`);
  if (b.otherItems) parts.push(`${b.otherItems} Other`);
  return parts.join(' · ') || '—';
}

type Bucket = 'actionable' | 'dueSoon' | 'overdue' | 'lapsed' | 'onTrack' | 'all';

function statusOf(d: number): { bucket: Exclude<Bucket, 'actionable' | 'all'>; label: string; cls: string } {
  if (d > 60) return { bucket: 'onTrack', label: 'On track', cls: 'bg-emerald-100 text-emerald-700' };
  if (d >= 0) return { bucket: 'dueSoon', label: `Due in ${d}d`, cls: 'bg-amber-100 text-amber-700' };
  if (d >= -365) return { bucket: 'overdue', label: `Overdue ${Math.abs(d)}d`, cls: 'bg-red-100 text-red-700' };
  return { bucket: 'lapsed', label: `Lapsed ${Math.round(Math.abs(d) / 30.4)}mo`, cls: 'bg-slate-200 text-slate-600' };
}

export default function ServicingHistory({
  clients,
  onSchedule,
}: {
  clients: BatchClient[];
  onSchedule: (c: BatchClient) => void;
}) {
  const [q, setQ] = useState('');
  const [bucket, setBucket] = useState<Bucket>('actionable');
  const [kind, setKind] = useState<'all' | 'customers' | 'prospects'>('all');
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');

  const counts = useMemo(() => {
    const c = { dueSoon: 0, overdue: 0, lapsed: 0, onTrack: 0 };
    for (const x of clients) c[statusOf(x.daysUntilDue).bucket]++;
    return c;
  }, [clients]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return clients.filter((c) => {
      const st = statusOf(c.daysUntilDue).bucket;
      if (bucket === 'actionable' && !(st === 'dueSoon' || st === 'overdue')) return false;
      if (bucket !== 'actionable' && bucket !== 'all' && st !== bucket) return false;
      if (kind === 'customers' && !c.customerId) return false;
      if (kind === 'prospects' && c.customerId) return false;
      if (needle && !`${c.clientName} ${c.phone ?? ''} ${c.address ?? ''}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [clients, q, bucket, kind]);

  async function addAsCustomer(c: BatchClient) {
    setBusy(c.key);
    setErr('');
    try {
      const res = await fetch('/api/servicing-batches/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: c.key }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed');
      window.location.reload();
    } catch (e: any) {
      setErr(e.message || 'Failed');
    } finally {
      setBusy(null);
    }
  }

  const chip = (b: Bucket, label: string, n?: number) => (
    <button
      key={b}
      onClick={() => setBucket(b)}
      className={`rounded-full border px-3 py-1 text-xs ${bucket === b ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
    >
      {label}
      {n !== undefined && <span className="ml-1 text-slate-400">{n}</span>}
    </button>
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Past servicing compiled per client and month (QuickBooks invoices plus the imported servicing records). A batch is the
        count of extinguishers, hose reels and blankets serviced in that month; the next service is due 12 months after the latest
        batch.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input className="input max-w-xs" placeholder="Search name, phone or address" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input w-auto" value={kind} onChange={(e) => setKind(e.target.value as any)}>
          <option value="all">Customers & prospects</option>
          <option value="customers">Customers only</option>
          <option value="prospects">Prospects only</option>
        </select>
        <div className="flex flex-wrap gap-2">
          {chip('actionable', 'Due now + overdue < 1 yr', counts.dueSoon + counts.overdue)}
          {chip('dueSoon', 'Due ≤ 60 days', counts.dueSoon)}
          {chip('overdue', 'Overdue', counts.overdue)}
          {chip('lapsed', 'Lapsed > 1 yr', counts.lapsed)}
          {chip('onTrack', 'On track', counts.onTrack)}
          {chip('all', 'All', clients.length)}
        </div>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Address</th>
              <th className="px-4 py-3">Last servicing batch</th>
              <th className="px-4 py-3">Next due</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {visible.slice(0, 300).map((c) => {
              const st = statusOf(c.daysUntilDue);
              return (
                <>
                  <tr key={c.key} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <button className="text-left font-medium text-ink-900 hover:underline" onClick={() => setOpen(open === c.key ? null : c.key)}>
                        {c.clientName}
                      </button>
                      {!c.customerId && <span className="badge ml-2 bg-sky-100 text-sky-700">Prospect</span>}
                      <div className="text-xs text-slate-400">{c.history.length} batch{c.history.length > 1 ? 'es' : ''} on record</div>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{c.phone ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{c.address ?? c.region ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-700">{monthLabel(c.latest.batchMonth)}</div>
                      <div className="text-xs text-slate-500">{batchSummary(c.latest)}</div>
                      <div className="text-xs text-slate-400">{SOURCE_LABEL[c.latest.source] ?? c.latest.source}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-600">{formatDate(c.nextDueDate)}</div>
                      <span className={`badge ${st.cls}`}>{st.label}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {c.customerId ? (
                        <button className="btn-secondary" onClick={() => onSchedule(c)}>
                          Schedule
                        </button>
                      ) : (
                        <button className="btn-secondary" disabled={busy === c.key} onClick={() => addAsCustomer(c)}>
                          {busy === c.key ? 'Adding…' : 'Add as customer'}
                        </button>
                      )}
                    </td>
                  </tr>
                  {open === c.key && (
                    <tr key={`${c.key}-h`} className="border-b border-slate-50 bg-slate-50/60">
                      <td colSpan={6} className="px-4 py-3">
                        <table className="w-full max-w-2xl text-xs">
                          <thead>
                            <tr className="text-left text-slate-400">
                              <th className="py-1 pr-4">Month</th>
                              <th className="py-1 pr-4">Serviced</th>
                              <th className="py-1 pr-4">Source</th>
                              <th className="py-1">Note</th>
                            </tr>
                          </thead>
                          <tbody>
                            {c.history.map((h) => (
                              <tr key={h.id} className="text-slate-600">
                                <td className="py-1 pr-4">{monthLabel(h.batchMonth)}</td>
                                <td className="py-1 pr-4">{batchSummary(h)}</td>
                                <td className="py-1 pr-4">
                                  {SOURCE_LABEL[h.source] ?? h.source}
                                  {h.sourceRef ? ` (${h.sourceRef})` : ''}
                                </td>
                                <td className="py-1 text-slate-400">{h.notes ?? ''}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  Nothing to show for this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {visible.length > 300 && <p className="px-4 py-2 text-xs text-slate-400">Showing the first 300 of {visible.length} — refine the search to see the rest.</p>}
      </div>
    </div>
  );
}
