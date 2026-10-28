'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDate } from '@/lib/format-date';
import { formatMoney } from '@/lib/money';

type R = {
  id: string;
  start: string;
  end: string;
  due: string;
  status: string;
  totalSales: number;
  taxableSales: number;
  outputTax: number;
  inputTax: number;
  outputAdjustment: number;
  inputAdjustment: number;
  netPayable: number;
  notes: string | null;
  filedAt: string | null;
  filedReference: string | null;
  paidAt: string | null;
  paidAmount: number | null;
  paymentReference: string | null;
};

export default function VatReturnWorksheet({
  r,
  currency,
  company,
  liveOutput,
  liveInput,
  counts,
}: {
  r: R;
  currency: string;
  company: { name: string; tin: string | null };
  liveOutput: number | null;
  liveInput: number | null;
  counts: { invoices: number; receipts: number; creditNotes: number; bills: number; purchases: number } | null;
}) {
  const router = useRouter();
  const m = (n: number) => formatMoney(n, currency);
  const [outAdj, setOutAdj] = useState(String(r.outputAdjustment));
  const [inAdj, setInAdj] = useState(String(r.inputAdjustment));
  const [notes, setNotes] = useState(r.notes ?? '');
  const [filedAt, setFiledAt] = useState(r.filedAt ?? new Date().toISOString().slice(0, 10));
  const [ref, setRef] = useState(r.filedReference ?? '');
  const [paidAt, setPaidAt] = useState(r.paidAt ?? new Date().toISOString().slice(0, 10));
  const [paidAmt, setPaidAmt] = useState(String(r.paidAmount ?? Math.max(0, r.netPayable)));
  const [payRef, setPayRef] = useState(r.paymentReference ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const draft = r.status === 'DRAFT';

  const outTotal = r.outputTax + (Number(outAdj) || 0);
  const inTotal = r.inputTax + (Number(inAdj) || 0);
  const net = Math.round((outTotal - inTotal) * 100) / 100;

  async function call(body: any) {
    setBusy(true);
    setErr('');
    const res = await fetch(`/api/tax/returns/${r.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) return setErr((await res.json().catch(() => ({}))).error || 'Something went wrong.');
    router.refresh();
  }
  async function remove() {
    if (!confirm('Delete this draft return?')) return;
    const res = await fetch(`/api/tax/returns/${r.id}`, { method: 'DELETE' });
    if (res.ok) router.push('/tax');
  }

  const stale = draft && liveOutput != null && liveInput != null && (Math.abs(liveOutput - r.outputTax) > 0.004 || Math.abs(liveInput - r.inputTax) > 0.004);
  const row = (label: string, value: string, bold = false) => (
    <div className={`flex items-center justify-between border-b border-slate-100 py-2 text-sm ${bold ? 'font-bold' : ''}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">VAT return</h1>
          <p className="text-sm text-slate-500">
            {formatDate(r.start)} to {formatDate(r.end)} · due {formatDate(r.due)} ·{' '}
            <span className="font-medium">{r.status === 'PAID' ? 'Paid' : r.status === 'FILED' ? 'Filed' : 'Draft'}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => window.print()}>🖨 Print / Export PDF</button>
          {draft && <button className="btn-secondary text-red-600" onClick={remove}>Delete draft</button>}
          {!draft && <button className="btn-secondary" onClick={() => call({ action: 'reopen' })}>Reopen as draft</button>}
        </div>
      </div>

      {stale && (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 print:hidden">
          Sales or bills have changed since this draft was prepared (now output {m(liveOutput!)} / input {m(liveInput!)}).{' '}
          <button className="underline" disabled={busy} onClick={() => call({ action: 'recalculate' })}>Recalculate</button>
        </div>
      )}

      <div className="print-area">
        <div className="bg-white p-8 text-ink-900" style={{ fontFamily: '"Courier New", Courier, monospace' }}>
          <div className="mb-6 flex items-start justify-between border-b-2 border-ink-900 pb-4">
            <div>
              <p className="text-2xl font-bold uppercase tracking-wide">VAT Return Worksheet</p>
              <p className="text-sm text-slate-500">{company.name}{company.tin ? ` · TIN ${company.tin}` : ''}</p>
            </div>
            <div className="text-right text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Period</p>
              <p className="font-bold">{formatDate(r.start)} - {formatDate(r.end)}</p>
              <p className="text-xs text-slate-500">Due {formatDate(r.due)}</p>
            </div>
          </div>

          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Sales (outputs)</p>
          {row('Total sales (excluding VAT, net of credit notes)', m(r.totalSales))}
          {row('Of which sales carrying VAT', m(r.taxableSales))}
          {row('Of which zero-rated / exempt / no VAT charged', m(r.totalSales - r.taxableSales))}
          {row('Output VAT on sales', m(r.outputTax))}
          <div className="flex items-center justify-between border-b border-slate-100 py-2 text-sm">
            <span>Adjustments to output VAT</span>
            {draft ? (
              <input className="input w-32 text-right" value={outAdj} onChange={(e) => setOutAdj(e.target.value)} inputMode="decimal" />
            ) : (
              <span>{m(r.outputAdjustment)}</span>
            )}
          </div>
          {row('Total output VAT', m(outTotal), true)}

          <p className="mb-1 mt-6 text-xs font-semibold uppercase tracking-wide text-slate-400">Purchases (inputs)</p>
          {counts && row(`Purchases (excluding VAT) - ${counts.bills} bill${counts.bills === 1 ? '' : 's'}`, m(counts.purchases))}
          {row('Input VAT on purchases (bills)', m(r.inputTax))}
          <div className="flex items-center justify-between border-b border-slate-100 py-2 text-sm">
            <span>Adjustments to input VAT (e.g. VAT on expenses without a bill)</span>
            {draft ? (
              <input className="input w-32 text-right" value={inAdj} onChange={(e) => setInAdj(e.target.value)} inputMode="decimal" />
            ) : (
              <span>{m(r.inputAdjustment)}</span>
            )}
          </div>
          {row('Total input VAT', m(inTotal), true)}

          <div className="mt-6 flex items-center justify-between border-y-2 border-ink-900 py-3 text-lg font-bold">
            <span>{net >= 0 ? 'VAT payable' : 'VAT refundable'}</span>
            <span>{m(Math.abs(net))}</span>
          </div>

          {(notes || draft) && (
            <div className="mt-4 text-sm">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Notes</p>
              {draft ? <textarea className="input w-full print:hidden" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /> : null}
              <p className="hidden whitespace-pre-line print:block">{notes}</p>
              {!draft && <p className="whitespace-pre-line print:hidden">{notes}</p>}
            </div>
          )}
          {r.status !== 'DRAFT' && (
            <p className="mt-4 text-sm text-slate-600">
              Filed {r.filedAt ? formatDate(r.filedAt) : ''}{r.filedReference ? ` (ref ${r.filedReference})` : ''}
              {r.paidAt ? ` · Paid ${formatDate(r.paidAt)} ${m(r.paidAmount ?? 0)}${r.paymentReference ? ` (ref ${r.paymentReference})` : ''}` : ''}
            </p>
          )}
          <p className="mt-6 text-xs text-slate-400">
            Worksheet only - compiled from invoices, sales receipts, credit notes and bills dated within the period. File the return with your tax authority.
            {counts ? ` Based on ${counts.invoices} invoice(s), ${counts.receipts} receipt(s), ${counts.creditNotes} credit note(s).` : ''}
          </p>
        </div>
      </div>

      {err && <p className="text-sm text-red-600 print:hidden">{err}</p>}

      <div className="grid gap-4 md:grid-cols-2 print:hidden">
        {draft && (
          <div className="card space-y-3 p-4">
            <h2 className="text-sm font-semibold text-ink-900">Prepare</h2>
            <div className="flex gap-2">
              <button className="btn-secondary" disabled={busy} onClick={() => call({ action: 'recalculate' })}>Recalculate from records</button>
              <button className="btn-primary" disabled={busy} onClick={() => call({ action: 'save', outputAdjustment: Number(outAdj) || 0, inputAdjustment: Number(inAdj) || 0, notes })}>
                Save adjustments &amp; notes
              </button>
            </div>
          </div>
        )}
        {draft && (
          <div className="card space-y-3 p-4">
            <h2 className="text-sm font-semibold text-ink-900">Mark as filed</h2>
            <div className="flex flex-wrap items-end gap-2 text-sm">
              <label>Filed on<input type="date" className="input mt-1" value={filedAt} onChange={(e) => setFiledAt(e.target.value)} /></label>
              <label>Reference<input className="input mt-1" value={ref} onChange={(e) => setRef(e.target.value)} /></label>
              <button className="btn-primary" disabled={busy} onClick={() => call({ action: 'file', filedAt, filedReference: ref || null })}>Mark filed</button>
            </div>
            <p className="text-xs text-slate-400">Save any adjustments first - a filed return is locked.</p>
          </div>
        )}
        {r.status !== 'PAID' && (
          <div className="card space-y-3 p-4">
            <h2 className="text-sm font-semibold text-ink-900">Record payment</h2>
            <div className="flex flex-wrap items-end gap-2 text-sm">
              <label>Paid on<input type="date" className="input mt-1" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} /></label>
              <label>Amount<input className="input mt-1 w-28" value={paidAmt} onChange={(e) => setPaidAmt(e.target.value)} inputMode="decimal" /></label>
              <label>Reference<input className="input mt-1" value={payRef} onChange={(e) => setPayRef(e.target.value)} /></label>
              <button className="btn-primary" disabled={busy} onClick={() => call({ action: 'pay', paidAt, paidAmount: Number(paidAmt) || 0, paymentReference: payRef || null })}>Mark paid</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
