'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  parseCsv,
  guessColumns,
  rowsFromTable,
  linesFromPdfItems,
  linesFromText,
  rowsFromTextLines,
  type ColumnMap,
  type ParseResult,
  type ParsedRow,
  type DateOrder,
} from '@/lib/statement-parse';

type Bank = { id: string; name: string };

async function pdfToLines(file: File, password: string) {
  const pdfjs: any = await import('pdfjs-dist/build/pdf.mjs');
  // Run pdf.js on the main thread (no separate worker file to serve).
  const worker: any = await import('pdfjs-dist/build/pdf.worker.mjs');
  (globalThis as any).pdfjsWorker = worker;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), password: password || undefined }).promise;
  const lines = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    lines.push(...linesFromPdfItems(tc.items as any));
  }
  return lines;
}

const fmt = (n: number | null | undefined) =>
  n == null ? '' : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function StatementImporter({ banks, defaultBankId }: { banks: Bank[]; defaultBankId?: string }) {
  const router = useRouter();
  const [bankId, setBankId] = useState(defaultBankId ?? '');
  const [fileName, setFileName] = useState('');
  const [password, setPassword] = useState('');
  const [pendingPdf, setPendingPdf] = useState<File | null>(null);
  const [table, setTable] = useState<string[][] | null>(null);
  const [map, setMap] = useState<ColumnMap | null>(null);
  const [textResult, setTextResult] = useState<ParseResult | null>(null);
  const [paste, setPaste] = useState('');
  const [order, setOrder] = useState<DateOrder>('DMY');
  const [skip, setSkip] = useState<Set<number>>(new Set());
  const [flip, setFlip] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<string>('');

  const result: ParseResult | null = useMemo(() => {
    if (table && map) return rowsFromTable(table, map);
    return textResult;
  }, [table, map, textResult]);

  const rows: ParsedRow[] = useMemo(
    () => (result?.rows ?? []).map((r, i) => (flip.has(i) ? { ...r, amount: -r.amount } : r)),
    [result, flip]
  );
  const included = rows.filter((_, i) => !skip.has(i));
  const totalIn = included.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0);
  const totalOut = included.filter((r) => r.amount < 0).reduce((s, r) => s - r.amount, 0);

  function reset() {
    setTable(null);
    setMap(null);
    setTextResult(null);
    setSkip(new Set());
    setFlip(new Set());
    setError('');
    setDone('');
  }

  async function readPdf(file: File, pw: string) {
    setBusy(true);
    setError('');
    try {
      const lines = await pdfToLines(file, pw);
      setTextResult(rowsFromTextLines(lines, order));
      setPendingPdf(null);
    } catch (e: any) {
      if (e?.name === 'PasswordException') {
        setPendingPdf(file);
        setError(pw ? 'That password did not open the PDF.' : 'This PDF is password-protected. Enter the password and press Open.');
      } else setError(`Could not read the PDF: ${e?.message ?? e}`);
    } finally {
      setBusy(false);
    }
  }

  async function onFile(f: File | undefined) {
    if (!f) return;
    reset();
    setFileName(f.name);
    if (/\.pdf$/i.test(f.name)) return readPdf(f, password);
    if (/\.(xlsx?|ods)$/i.test(f.name)) {
      setError('Excel files: open the file and use File > Save As > CSV, then import the CSV.');
      return;
    }
    const text = await f.text();
    const t = parseCsv(text);
    if (t.length < 2) return setError('That file has no rows.');
    setTable(t);
    setMap(guessColumns(t));
  }

  function onPaste() {
    reset();
    setFileName('Pasted statement');
    setTextResult(rowsFromTextLines(linesFromText(paste), order));
  }

  async function submit() {
    if (!bankId) return setError('Choose which account this statement is for.');
    if (!included.length) return setError('No lines to import.');
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/bank-statements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bankAccountId: bankId,
          fileName,
          openingBalance: result?.openingBalance ?? null,
          closingBalance: result?.closingBalance ?? null,
          rows: included,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? body?.error?.formErrors?.[0] ?? 'Import failed');
      setDone(
        `Imported ${body.inserted} line(s)${body.skipped ? `, skipped ${body.skipped} already imported` : ''}. ${body.autoMatched} matched automatically.`
      );
      router.push(`/accounting/reconcile?bank=${bankId}`);
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const headers = table && map ? table[map.headerRow] ?? [] : [];
  const colSelect = (key: keyof ColumnMap, label: string, allowNone = true) =>
    map && (
      <div>
        <label className="label">{label}</label>
        <select
          className="input"
          value={map[key] as number}
          onChange={(e) => setMap({ ...map, [key]: parseInt(e.target.value, 10) })}
        >
          {allowNone && <option value={-1}>— none —</option>}
          {headers.map((h, i) => (
            <option key={i} value={i}>
              {h || `Column ${i + 1}`}
            </option>
          ))}
        </select>
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="card grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
        <div>
          <label className="label">Statement for</label>
          <select className="input" value={bankId} onChange={(e) => setBankId(e.target.value)}>
            <option value="">Select account…</option>
            {banks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Dates on the statement are</label>
          <select className="input" value={order} onChange={(e) => setOrder(e.target.value as DateOrder)}>
            <option value="DMY">Day / month / year (31/12/2026)</option>
            <option value="MDY">Month / day / year (12/31/2026)</option>
          </select>
        </div>
        <div>
          <label className="label">Statement file (CSV or PDF)</label>
          <input type="file" accept=".csv,.txt,.pdf,.xls,.xlsx" className="input" onChange={(e) => onFile(e.target.files?.[0])} />
          <p className="mt-1 text-xs text-slate-400">The file is read in your browser; only the transaction lines are saved.</p>
        </div>
        <div>
          <label className="label">PDF password (if any)</label>
          <div className="flex gap-2">
            <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" />
            {pendingPdf && (
              <button type="button" className="btn-secondary" disabled={busy} onClick={() => readPdf(pendingPdf, password)}>
                Open
              </button>
            )}
          </div>
        </div>
        <div className="sm:col-span-2">
          <details>
            <summary className="cursor-pointer text-sm text-brand-600">Or paste statement lines</summary>
            <textarea
              className="input mt-2 font-mono text-xs"
              rows={6}
              placeholder={'02/10/2026  POS SETTLEMENT VISA  1,375.00  21,375.00\n05/10/2026  BANK CHARGES  150.00  21,225.00'}
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
            />
            <button type="button" className="btn-secondary mt-2" disabled={!paste.trim()} onClick={onPaste}>
              Read pasted lines
            </button>
          </details>
        </div>
      </div>

      {table && map && (
        <div className="card grid grid-cols-2 gap-4 p-6 sm:grid-cols-4">
          <p className="col-span-full text-sm font-semibold text-ink-900">Columns (check the guesses)</p>
          <div>
            <label className="label">Header row</label>
            <input
              type="number"
              min={1}
              className="input"
              value={map.headerRow + 1}
              onChange={(e) => setMap({ ...map, headerRow: Math.max(0, (parseInt(e.target.value, 10) || 1) - 1) })}
            />
          </div>
          {colSelect('date', 'Date', false)}
          {colSelect('description', 'Description', false)}
          {colSelect('reference', 'Reference')}
          {colSelect('debit', 'Money out (debit)')}
          {colSelect('credit', 'Money in (credit)')}
          {colSelect('amount', 'Single amount column')}
          {colSelect('balance', 'Balance')}
          {map.amount >= 0 && (
            <label className="col-span-full flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={map.invertAmount} onChange={(e) => setMap({ ...map, invertAmount: e.target.checked })} />
              Positive amounts in this column are money out
            </label>
          )}
          <div>
            <label className="label">Date format</label>
            <select className="input" value={map.dateOrder} onChange={(e) => setMap({ ...map, dateOrder: e.target.value as DateOrder })}>
              <option value="DMY">Day first</option>
              <option value="MDY">Month first</option>
            </select>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {busy && <p className="text-sm text-slate-500">Working…</p>}

      {result && (
        <div className="card overflow-x-auto">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-sm">
            <div className="space-y-0.5">
              <p className="font-semibold text-ink-900">
                {rows.length} line(s) found · {included.length} to import
              </p>
              <p className="text-xs text-slate-500">
                Money in {fmt(totalIn)} · Money out {fmt(totalOut)}
                {result.openingBalance != null && ` · Opening ${fmt(result.openingBalance)}`}
                {result.closingBalance != null && ` · Closing ${fmt(result.closingBalance)}`}
              </p>
              {result.balanceChecked + result.balanceMismatches > 0 && (
                <p className={`text-xs ${result.balanceMismatches ? 'text-amber-600' : 'text-emerald-600'}`}>
                  Running balance check: {result.balanceChecked} agree
                  {result.balanceMismatches ? `, ${result.balanceMismatches} don't — check those lines` : ' ✓'}
                </p>
              )}
              {result.warnings.map((w) => (
                <p key={w} className="text-xs text-amber-600">
                  {w}
                </p>
              ))}
            </div>
            <button type="button" className="btn-primary" disabled={busy || !included.length || !bankId} onClick={submit}>
              {busy ? 'Importing…' : `Import ${included.length} line(s)`}
            </button>
          </div>
          {done && <p className="px-4 py-2 text-sm text-emerald-700">{done}</p>}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
                <th className="px-3 py-2">Use</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2 text-right">Money in</th>
                <th className="px-3 py-2 text-right">Money out</th>
                <th className="px-3 py-2 text-right">Balance</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className={`border-b border-slate-50 ${skip.has(i) ? 'opacity-40' : ''}`}>
                  <td className="px-3 py-1.5">
                    <input
                      type="checkbox"
                      checked={!skip.has(i)}
                      onChange={() => setSkip((s) => {
                        const n = new Set(s);
                        n.has(i) ? n.delete(i) : n.add(i);
                        return n;
                      })}
                    />
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-slate-500">{r.date.split('-').reverse().join('/')}</td>
                  <td className="px-3 py-1.5">
                    {r.description}
                    {r.reference && <span className="ml-1 text-xs text-slate-400">({r.reference})</span>}
                  </td>
                  <td className="px-3 py-1.5 text-right text-emerald-700">{r.amount > 0 ? fmt(r.amount) : ''}</td>
                  <td className="px-3 py-1.5 text-right text-red-600">{r.amount < 0 ? fmt(-r.amount) : ''}</td>
                  <td className="px-3 py-1.5 text-right text-slate-500">{fmt(r.balance)}</td>
                  <td className="px-3 py-1.5 text-right">
                    <button
                      type="button"
                      className="text-xs text-slate-400 hover:text-brand-600"
                      title="Swap money in / money out"
                      onClick={() => setFlip((s) => {
                        const n = new Set(s);
                        n.has(i) ? n.delete(i) : n.add(i);
                        return n;
                      })}
                    >
                      ⇄
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
