/**
 * Bank statement parsing (accounting plan, Phase 3). Pure functions, used in
 * the browser: the file never leaves the user's machine, only the parsed
 * lines are sent to the server.
 *
 * Two inputs:
 *  - CSV exports: a header row + a column mapping (auto-guessed, editable).
 *  - PDF statements: text lines (with x positions from pdf.js) or pasted text.
 *    Each transaction line starts with a date and ends with amount columns;
 *    the column headers ("Debit", "Credit", "Balance"...) tell which amount is
 *    which, and the running balance is used to work out / double-check the
 *    sign of each line.
 */

export type ParsedRow = {
  date: string; // YYYY-MM-DD
  description: string;
  reference?: string | null;
  amount: number; // + money in, - money out
  balance?: number | null;
};

export type ParseResult = {
  rows: ParsedRow[];
  openingBalance: number | null;
  closingBalance: number | null;
  /** How many rows agree with the running balance printed on the statement. */
  balanceChecked: number;
  balanceMismatches: number;
  warnings: string[];
};

// ---------------------------------------------------------------------------
// Dates and amounts
// ---------------------------------------------------------------------------

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

const pad = (n: number) => String(n).padStart(2, '0');
const fullYear = (y: number) => (y < 100 ? 2000 + y : y);

export type DateOrder = 'DMY' | 'MDY';

/** Parse a date in the usual statement formats. Returns YYYY-MM-DD or null. */
export function parseDate(raw: string, order: DateOrder = 'DMY'): string | null {
  const s = raw.trim().replace(/\s+/g, ' ');
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[-/. ]([A-Za-z]{3,9})[-/. ,]*(\d{2,4})/);
  if (m) {
    const mo = MONTHS[m[2].toLowerCase().slice(0, m[2].toLowerCase().startsWith('sept') ? 4 : 3)];
    if (mo) return valid(fullYear(+m[3]), mo, +m[1]);
  }
  m = s.match(/^([A-Za-z]{3,9}) (\d{1,2}),? (\d{4})/);
  if (m) {
    const mo = MONTHS[m[1].toLowerCase().slice(0, 3)];
    if (mo) return valid(+m[3], mo, +m[2]);
  }
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) {
    const a = +m[1], b = +m[2], y = fullYear(+m[3]);
    if (order === 'MDY' && a <= 12) return valid(y, a, b);
    return valid(y, b, a);
  }
  return null;
}

function valid(y: number, mo: number, d: number) {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCMonth() !== mo - 1) return null;
  return `${y}-${pad(mo)}-${pad(d)}`;
}

/** Looks like the start of a statement line (a date at the very beginning). */
const DATE_START = /^(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{1,2}[-/. ][A-Za-z]{3,9}[-/. ,]*\d{2,4})\b/;

/**
 * Parse a money string: "1,234.56", "(1,234.56)", "-1234.56", "1 234,56",
 * "1,234.56 DR", "1,234.56CR", "SCR 1,234.56". Returns null if not a number.
 */
export function parseAmount(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  let s = raw.trim();
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1);
  }
  const drcr = s.match(/\s*(DR|CR|Dr|Cr|D|C)\.?$/);
  if (drcr) {
    if (/^d/i.test(drcr[1])) neg = !neg;
    s = s.slice(0, drcr.index).trim();
  }
  s = s.replace(/^(SCR|SR|Rs\.?|USD|EUR|\$|€)\s*/i, '');
  if (s.endsWith('-')) {
    neg = !neg;
    s = s.slice(0, -1);
  }
  if (s.startsWith('-')) {
    neg = !neg;
    s = s.slice(1);
  } else if (s.startsWith('+')) s = s.slice(1);
  s = s.replace(/\s/g, '');
  // "1.234,56" (comma decimals)
  if (/^\d{1,3}(\.\d{3})+,\d{2}$/.test(s) || /^\d+,\d{2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, '');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Math.round(parseFloat(s) * 100) / 100;
  return neg ? -n : n;
}

/** A token that is clearly a money amount (has 2 decimals), as printed in statements. */
const MONEY_TOKEN = /^\(?-?(SCR|SR)?\s?\d{1,3}(,\d{3})*(\.\d{2})\)?-?(\s?(CR|DR|Cr|Dr))?$|^\(?-?\d+\.\d{2}\)?-?(\s?(CR|DR|Cr|Dr))?$/;

const r2 = (n: number) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/** Minimal RFC-4180 CSV parser (quotes, escaped quotes, , ; or tab separators). */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, '');
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? '';
  const sep = [',', ';', '\t'].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (q) {
      if (c === '"') {
        if (clean[i + 1] === '"') {
          cell += '"';
          i++;
        } else q = false;
      } else cell += c;
    } else if (c === '"') q = true;
    else if (c === sep) {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && clean[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ''));
}

export type ColumnMap = {
  headerRow: number;
  date: number;
  description: number;
  reference: number; // -1 = none
  amount: number; // single signed amount column, -1 = none
  debit: number; // money out column, -1 = none
  credit: number; // money in column, -1 = none
  balance: number; // -1 = none
  dateOrder: DateOrder;
  /** For a single amount column: true if positive numbers are money OUT. */
  invertAmount: boolean;
};

/** Keyword match; keys of 3 letters or fewer must be whole words ("cr" must not match "description"). */
const has = (h: string, ...keys: string[]) =>
  keys.some((k) => (k.length <= 3 ? new RegExp(`(^|[^a-z])${k}([^a-z]|$)`).test(h) : h.includes(k)));

/** Guess which column is which from the header row. */
export function guessColumns(table: string[][]): ColumnMap {
  let headerRow = 0;
  for (let i = 0; i < Math.min(table.length, 15); i++) {
    const line = table[i].join(' ').toLowerCase();
    if (has(line, 'date') && (has(line, 'amount', 'debit', 'credit', 'withdraw', 'deposit', 'balance', 'paid'))) {
      headerRow = i;
      break;
    }
  }
  const h = (table[headerRow] ?? []).map((c) => c.toLowerCase());
  const find = (pred: (s: string) => boolean) => h.findIndex(pred);
  const date = find((s) => has(s, 'date') && !has(s, 'value')) >= 0 ? find((s) => has(s, 'date') && !has(s, 'value')) : find((s) => has(s, 'date'));
  const description =
    find((s) => has(s, 'description', 'narrative', 'details', 'particular', 'memo', 'remark')) >= 0
      ? find((s) => has(s, 'description', 'narrative', 'details', 'particular', 'memo', 'remark'))
      : find((s) => has(s, 'transaction') && !has(s, 'date'));
  const reference = find((s) => has(s, 'reference', 'ref', 'cheque', 'chq'));
  const debit = find((s) => has(s, 'debit', 'withdraw', 'paid out', 'money out', 'dr'));
  const credit = find((s) => has(s, 'credit', 'deposit', 'paid in', 'money in', 'cr') && !has(s, 'card'));
  const balance = find((s) => has(s, 'balance'));
  const amount = debit < 0 && credit < 0 ? find((s) => has(s, 'amount', 'value')) : -1;
  const sample = table.slice(headerRow + 1, headerRow + 40).map((r) => r[date] ?? '');
  const dateOrder: DateOrder = sample.some((s) => {
    const m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.]/);
    return m && +m[2] > 12;
  })
    ? 'MDY'
    : 'DMY';
  return {
    headerRow,
    date: date >= 0 ? date : 0,
    description: description >= 0 ? description : 1,
    reference: reference !== description ? reference : -1,
    amount,
    debit,
    credit: credit !== debit ? credit : -1,
    balance,
    dateOrder,
    invertAmount: false,
  };
}

export function rowsFromTable(table: string[][], map: ColumnMap): ParseResult {
  const rows: ParsedRow[] = [];
  const warnings: string[] = [];
  let skipped = 0;
  for (const r of table.slice(map.headerRow + 1)) {
    const date = parseDate(r[map.date] ?? '', map.dateOrder);
    if (!date) {
      skipped++;
      continue;
    }
    let amount: number | null = null;
    if (map.amount >= 0) {
      const a = parseAmount(r[map.amount]);
      if (a != null) amount = map.invertAmount ? -a : a;
    } else {
      const d = map.debit >= 0 ? parseAmount(r[map.debit]) : null;
      const c = map.credit >= 0 ? parseAmount(r[map.credit]) : null;
      if (d != null || c != null) amount = r2(Math.abs(c ?? 0) - Math.abs(d ?? 0));
    }
    if (amount == null || amount === 0) {
      skipped++;
      continue;
    }
    rows.push({
      date,
      description: (r[map.description] ?? '').replace(/\s+/g, ' ').trim() || '(no description)',
      reference: map.reference >= 0 ? r[map.reference] || null : null,
      amount,
      balance: map.balance >= 0 ? parseAmount(r[map.balance]) : null,
    });
  }
  if (skipped) warnings.push(`${skipped} line(s) without a date or amount were skipped.`);
  return finish(rows, null, warnings);
}

// ---------------------------------------------------------------------------
// PDF / pasted text
// ---------------------------------------------------------------------------

export type TextCell = { x: number; right: number; text: string };
export type TextLine = { cells: TextCell[] };

/** Group pdf.js text items into lines (same y), cells sorted left to right. */
export function linesFromPdfItems(items: { str: string; transform: number[]; width: number }[]): TextLine[] {
  const rows: { y: number; cells: TextCell[] }[] = [];
  for (const it of items) {
    const text = it.str.trim();
    if (!text) continue;
    const x = it.transform[4];
    const y = it.transform[5];
    let row = rows.find((r) => Math.abs(r.y - y) < 3);
    if (!row) {
      row = { y, cells: [] };
      rows.push(row);
    }
    row.cells.push({ x, right: x + it.width, text });
  }
  rows.sort((a, b) => b.y - a.y);
  return rows.map((r) => {
    const cells = r.cells.sort((a, b) => a.x - b.x);
    // Merge fragments that touch (pdf.js often splits one word into pieces).
    const merged: TextCell[] = [];
    for (const c of cells) {
      const last = merged[merged.length - 1];
      if (last && c.x - last.right < 1.5) {
        last.text += c.text;
        last.right = c.right;
      } else merged.push({ ...c });
    }
    return { cells: merged };
  });
}

/** Pasted text: split each line into cells on 2+ spaces or tabs (no x positions). */
export function linesFromText(text: string): TextLine[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => ({
      cells: l
        .split(/\t|\s{2,}/)
        .flatMap((c) => splitMoneyTail(c))
        .map((t, i) => ({ x: i * 10, right: i * 10 + 5, text: t })),
    }));
}

/** "Payment ABC 1,200.00 5,300.00" -> ["Payment ABC", "1,200.00", "5,300.00"] */
function splitMoneyTail(cell: string): string[] {
  const parts = cell.split(' ');
  const tail: string[] = [];
  while (parts.length > 1 && MONEY_TOKEN.test(parts[parts.length - 1])) tail.unshift(parts.pop()!);
  return [parts.join(' '), ...tail].filter(Boolean);
}

type Cols = { debit?: number; credit?: number; amount?: number; balance?: number };

function headerColumns(line: TextLine): Cols | null {
  const txt = line.cells.map((c) => c.text.toLowerCase()).join(' ');
  if (!has(txt, 'date') || !has(txt, 'balance', 'debit', 'credit', 'amount', 'withdraw', 'deposit')) return null;
  const cols: Cols = {};
  for (const c of line.cells) {
    const t = c.text.toLowerCase();
    const right = c.right;
    if (has(t, 'balance')) cols.balance = right;
    else if (has(t, 'debit', 'withdraw', 'paid out', 'money out')) cols.debit = right;
    else if (has(t, 'credit', 'deposit', 'paid in', 'money in')) cols.credit = right;
    else if (has(t, 'amount')) cols.amount = right;
  }
  return Object.keys(cols).length ? cols : null;
}

const NOISE = /(page \d+|statement of account|continued|carried forward|account number|account no|iban|swift|branch|currency|total|^date\b)/i;
const OPENING = /(brought forward|opening balance|balance b\/f|balance forward|previous balance)/i;
const CLOSING = /(closing balance|balance c\/f|carried forward|ending balance)/i;

/**
 * Turn statement text lines into transactions. Works with pdf.js output (x
 * positions known: amounts are assigned to the nearest header column) or plain
 * pasted text (amounts read from the end of the line; the running balance
 * decides money in vs out).
 */
export function rowsFromTextLines(lines: TextLine[], order: DateOrder = 'DMY'): ParseResult {
  let cols: Cols | null = null;
  const warnings: string[] = [];
  let opening: number | null = null;
  let closing: number | null = null;
  type Draft = { date: string; desc: string[]; amounts: { v: number; right: number; raw: string }[] };
  const drafts: Draft[] = [];
  let current: Draft | null = null;

  for (const line of lines) {
    const hdr = headerColumns(line);
    if (hdr) {
      cols = hdr;
      current = null;
      continue;
    }
    const text = line.cells.map((c) => c.text).join(' ');
    const moneyCells = line.cells.filter((c) => MONEY_TOKEN.test(c.text.trim()));
    if (OPENING.test(text) && moneyCells.length) {
      opening = parseAmount(moneyCells[moneyCells.length - 1].text);
      current = null;
      continue;
    }
    if (CLOSING.test(text) && moneyCells.length) {
      closing = parseAmount(moneyCells[moneyCells.length - 1].text);
      current = null;
      continue;
    }
    const first = line.cells[0]?.text ?? '';
    const dateMatch = first.match(DATE_START) ?? text.match(DATE_START);
    const date = dateMatch ? parseDate(dateMatch[0], order) : null;
    if (date && moneyCells.length) {
      const descCells = line.cells.filter((c) => !moneyCells.includes(c));
      let desc = descCells.map((c) => c.text).join(' ').replace(/\s+/g, ' ').trim();
      // Drop the transaction date and a value date in front of the description.
      for (let k = 0; k < 2; k++) desc = desc.replace(DATE_START, '').trim();
      current = {
        date,
        desc: desc ? [desc] : [],
        amounts: moneyCells.map((c) => ({ v: parseAmount(c.text) ?? 0, right: c.right, raw: c.text })),
      };
      drafts.push(current);
    } else if (current && !moneyCells.length && !NOISE.test(text) && !date) {
      if (current.desc.join(' ').length < 200) current.desc.push(text.trim());
    } else if (!date) {
      current = null;
    }
  }

  // Newest-first statements: walk them oldest-first so the running balance works.
  if (drafts.length > 1 && drafts[0].date > drafts[drafts.length - 1].date) drafts.reverse();
  const rows: ParsedRow[] = [];
  let prevBal = opening;
  for (const d of drafts) {
    let debit: number | null = null;
    let credit: number | null = null;
    let amount: number | null = null;
    let balance: number | null = null;
    if (cols && Object.keys(cols).length >= 2) {
      const entries = Object.entries(cols) as [keyof Cols, number][];
      for (const a of d.amounts) {
        const [k] = entries.reduce((best, e) => (Math.abs(e[1] - a.right) < Math.abs(best[1] - a.right) ? e : best));
        if (k === 'balance') balance = a.v;
        else if (k === 'debit') debit = Math.abs(a.v);
        else if (k === 'credit') credit = Math.abs(a.v);
        else amount = a.v;
      }
      if (debit != null || credit != null) amount = r2((credit ?? 0) - (debit ?? 0));
    } else {
      // No column positions: last number is the balance when there are 2+.
      const vals = d.amounts.map((a) => a.v);
      if (vals.length >= 2) {
        balance = vals[vals.length - 1];
        const rest = vals.slice(0, -1).filter((v) => v !== 0);
        amount = rest.length ? rest[rest.length - 1] : null;
      } else amount = vals[0] ?? null;
    }
    // The running balance is the most reliable sign: money in raises it.
    if (balance != null && prevBal != null) {
      const diff = r2(balance - prevBal);
      if (amount == null || Math.abs(Math.abs(amount) - Math.abs(diff)) < 0.005) amount = diff;
    }
    if (amount == null || amount === 0) {
      if (balance != null) prevBal = balance;
      continue;
    }
    rows.push({ date: d.date, description: d.desc.join(' ').trim() || '(no description)', amount, balance });
    if (balance != null) prevBal = balance;
  }
  if (!drafts.length) warnings.push('No transaction lines were recognised. Check the file is a statement with dated lines.');
  if (!cols) warnings.push('No column headings found; money in/out was worked out from the running balance. Please check the signs below.');
  return finish(rows, opening, warnings, closing);
}

function finish(rows: ParsedRow[], opening: number | null, warnings: string[], closing: number | null = null): ParseResult {
  // Statements are sometimes newest-first: put them oldest-first.
  if (rows.length > 1 && rows[0].date > rows[rows.length - 1].date) rows.reverse();
  let checked = 0;
  let mismatches = 0;
  let prev = opening;
  for (const r of rows) {
    if (r.balance != null && prev != null) {
      if (Math.abs(r2(prev + r.amount) - r.balance) < 0.01) checked++;
      else mismatches++;
    }
    if (r.balance != null) prev = r.balance;
  }
  const lastBal = [...rows].reverse().find((r) => r.balance != null)?.balance ?? null;
  if (opening == null && rows[0]?.balance != null) opening = r2(rows[0].balance - rows[0].amount);
  return {
    rows,
    openingBalance: opening,
    closingBalance: closing ?? lastBal,
    balanceChecked: checked,
    balanceMismatches: mismatches,
    warnings,
  };
}
