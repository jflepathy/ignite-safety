'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDate } from '@/lib/format-date';
import { formatMoney } from '@/lib/money';

type P = { start: string; end: string; label: string; due: string };
type R = {
  id: string;
  start: string;
  end: string;
  due: string;
  status: string;
  outputTax: number;
  inputTax: number;
  netPayable: number;
  filedAt: string | null;
  paidAt: string | null;
  paidAmount: number | null;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function rangeLabel(a: string, b: string) {
  const s = new Date(a), e = new Date(b);
  const same = s.getUTCFullYear() === e.getUTCFullYear() && s.getUTCMonth() === e.getUTCMonth();
  return same ? `${MONTHS[s.getUTCMonth()]} ${s.getUTCFullYear()}` : `${MONTHS[s.getUTCMonth()]} - ${MONTHS[e.getUTCMonth()]} ${e.getUTCFullYear()}`;
}

export default function VatCalendar({
  isAdmin,
  currency,
  frequency,
  dueDay,
  periods,
  returns,
}: {
  isAdmin: boolean;
  currency: string;
  frequency: string;
  dueDay: number;
  periods: P[];
  returns: R[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [freq, setFreq] = useState(frequency);
  const [day, setDay] = useState(dueDay);
  const [saved, setSaved] = useState(false);
  const todayIso = new Date().toISOString().slice(0, 10);
  const byPeriod = new Map(returns.map((r) => [`${r.start}|${r.end}`, r]));

  async function open(p: { start: string; end: string }) {
    setBusy(p.start);
    const res = await fetch('/api/tax/returns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ periodStart: p.start, periodEnd: p.end }),
    });
    if (res.ok) {
      const r = await res.json();
      router.push(`/tax/returns/${r.id}`);
    } else setBusy(null);
  }

  async function saveSettings() {
    const res = await fetch('/api/tax/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vatFilingFrequency: freq, vatDueDay: Number(day) }),
    });
    if (res.ok) {
      setSaved(true);
      router.refresh();
    }
  }

  const status = (p: P, r?: R) => {
    if (r?.status === 'PAID') return <span className="badge bg-emerald-100 text-emerald-700">Paid {r.paidAt ? formatDate(r.paidAt) : ''}</span>;
    if (r?.status === 'FILED') return <span className="badge bg-blue-100 text-blue-700">Filed {r.filedAt ? formatDate(r.filedAt) : ''} - payment pending</span>;
    if (p.end > todayIso) return <span className="badge bg-slate-100 text-slate-600">Period open</span>;
    if (p.due < todayIso) return <span className="badge bg-red-100 text-red-700">Overdue - not filed</span>;
    return <span className="badge bg-amber-100 text-amber-700">Due {formatDate(p.due)}</span>;
  };

  return (
    <>
      <div className="card overflow-x-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-ink-900">VAT filing calendar</h2>
            <p className="text-xs text-slate-500">
              {frequency === 'QUARTERLY' ? 'Quarterly' : 'Monthly'} returns, due on day {dueDay} of the following month. Check the dates against your tax authority's requirements.
            </p>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2 text-sm">
              <select className="input w-auto" value={freq} onChange={(e) => { setFreq(e.target.value); setSaved(false); }}>
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
              </select>
              <span className="text-slate-500">due day</span>
              <input type="number" min={1} max={31} className="input w-20" value={day} onChange={(e) => { setDay(Number(e.target.value)); setSaved(false); }} />
              <button className="btn-secondary" onClick={saveSettings}>{saved ? '✓ Saved' : 'Save'}</button>
            </div>
          )}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-2">Period</th>
              <th className="px-4 py-2">Due date</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2 text-right">VAT payable</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {[...periods].reverse().map((p) => {
              const r = byPeriod.get(`${p.start}|${p.end}`);
              return (
                <tr key={p.start} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium text-ink-900">{p.label}</td>
                  <td className="px-4 py-2 text-slate-600">{formatDate(p.due)}</td>
                  <td className="px-4 py-2">{status(p, r)}</td>
                  <td className="px-4 py-2 text-right">{r ? formatMoney(r.netPayable, currency) : '—'}</td>
                  <td className="px-4 py-2 text-right">
                    {isAdmin && (
                      <button className="btn-secondary" disabled={busy === p.start} onClick={() => (r ? router.push(`/tax/returns/${r.id}`) : open(p))}>
                        {r ? 'Open return' : busy === p.start ? 'Preparing…' : 'Prepare return'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {returns.length > 0 && (
        <div className="card overflow-x-auto">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-ink-900">Returns filed and paid</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
                <th className="px-4 py-2">Period</th>
                <th className="px-4 py-2 text-right">Output VAT</th>
                <th className="px-4 py-2 text-right">Input VAT</th>
                <th className="px-4 py-2 text-right">Net payable</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Filed</th>
                <th className="px-4 py-2">Paid</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {returns.map((r) => (
                <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium text-ink-900">{rangeLabel(r.start, r.end)}</td>
                  <td className="px-4 py-2 text-right">{formatMoney(r.outputTax, currency)}</td>
                  <td className="px-4 py-2 text-right">{formatMoney(r.inputTax, currency)}</td>
                  <td className="px-4 py-2 text-right font-medium">{formatMoney(r.netPayable, currency)}</td>
                  <td className="px-4 py-2">{r.status === 'PAID' ? 'Paid' : r.status === 'FILED' ? 'Filed' : 'Draft'}</td>
                  <td className="px-4 py-2 text-slate-500">{r.filedAt ? formatDate(r.filedAt) : '—'}</td>
                  <td className="px-4 py-2 text-slate-500">{r.paidAt ? `${formatDate(r.paidAt)} · ${formatMoney(r.paidAmount ?? 0, currency)}` : '—'}</td>
                  <td className="px-4 py-2 text-right">
                    {isAdmin && <button className="btn-secondary" onClick={() => router.push(`/tax/returns/${r.id}`)}>Open</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
