import { prisma } from '@/lib/prisma';
import { SOURCE_LABEL, type SourceType } from '@/lib/ledger';

/**
 * Financial statements straight from the general ledger (journal_lines).
 * Dates are Seychelles calendar days (UTC+4): `from` is inclusive from 00:00,
 * `to` is inclusive through 23:59:59 of that day.
 */
export const dayStart = (d: string) => new Date(`${d}T00:00:00+04:00`);
export const dayEnd = (d: string) => new Date(new Date(`${d}T00:00:00+04:00`).getTime() + 24 * 3600 * 1000);

export function todaySey() {
  return new Date(Date.now() + 4 * 3600 * 1000).toISOString().slice(0, 10);
}

export type AccountRow = {
  id: string;
  code: string | null;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
  subtype: string | null;
  debit: number;
  credit: number;
};

/** Debit / credit totals per account for entries dated in [from, to]. */
export async function accountTotals(opts: { from?: string; to?: string }): Promise<AccountRow[]> {
  const params: any[] = [];
  const conds: string[] = [];
  if (opts.from) {
    params.push(dayStart(opts.from));
    conds.push(`e."date" >= $${params.length}`);
  }
  if (opts.to) {
    params.push(dayEnd(opts.to));
    conds.push(`e."date" < $${params.length}`);
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const rows: any[] = await prisma.$queryRawUnsafe(
    `SELECT a."id", a."code", a."name", a."type"::text AS "type", a."subtype",
            COALESCE(SUM(l."debit"),0)::float8 AS "debit", COALESCE(SUM(l."credit"),0)::float8 AS "credit"
       FROM "journal_lines" l
       JOIN "journal_entries" e ON e."id" = l."journalEntryId"
       JOIN "accounts" a ON a."id" = l."accountId"
       ${where}
      GROUP BY a."id", a."code", a."name", a."type", a."subtype"
      ORDER BY a."code" NULLS LAST, a."name"`,
    ...params
  );
  return rows.map((r) => ({ ...r, debit: Number(r.debit), credit: Number(r.credit) }));
}

/** Natural-sign balance: assets & expenses are debit-positive, the rest credit-positive. */
export function naturalBalance(r: Pick<AccountRow, 'type' | 'debit' | 'credit'>) {
  return r.type === 'ASSET' || r.type === 'EXPENSE' ? r.debit - r.credit : r.credit - r.debit;
}

const isCogs = (r: AccountRow) => r.type === 'EXPENSE' && (r.subtype ?? '').toLowerCase().includes('cost of goods');
const isOtherIncome = (r: AccountRow) => r.type === 'INCOME' && (r.subtype ?? '').toLowerCase().includes('other');

export async function profitAndLoss(from: string, to: string) {
  const rows = (await accountTotals({ from, to })).filter((r) => r.type === 'INCOME' || r.type === 'EXPENSE');
  const line = (r: AccountRow) => ({ id: r.id, code: r.code, name: r.name, amount: Math.round(naturalBalance(r) * 100) / 100 });
  const income = rows.filter((r) => r.type === 'INCOME' && !isOtherIncome(r)).map(line).filter((l) => l.amount !== 0);
  const cogs = rows.filter(isCogs).map(line).filter((l) => l.amount !== 0);
  const expenses = rows.filter((r) => r.type === 'EXPENSE' && !isCogs(r)).map(line).filter((l) => l.amount !== 0);
  const otherIncome = rows.filter(isOtherIncome).map(line).filter((l) => l.amount !== 0);
  const sum = (ls: { amount: number }[]) => Math.round(ls.reduce((s, l) => s + l.amount, 0) * 100) / 100;
  const totalIncome = sum(income);
  const totalCogs = sum(cogs);
  const grossProfit = Math.round((totalIncome - totalCogs) * 100) / 100;
  const totalExpenses = sum(expenses);
  const totalOtherIncome = sum(otherIncome);
  const netProfit = Math.round((grossProfit - totalExpenses + totalOtherIncome) * 100) / 100;
  return { income, cogs, expenses, otherIncome, totalIncome, totalCogs, grossProfit, totalExpenses, totalOtherIncome, netProfit };
}

export async function balanceSheet(asOf: string) {
  const rows = await accountTotals({ to: asOf });
  const line = (r: AccountRow) => ({ id: r.id, code: r.code, name: r.name, subtype: r.subtype, amount: Math.round(naturalBalance(r) * 100) / 100 });
  const assets = rows.filter((r) => r.type === 'ASSET').map(line).filter((l) => l.amount !== 0);
  const liabilities = rows.filter((r) => r.type === 'LIABILITY').map(line).filter((l) => l.amount !== 0);
  const equity = rows.filter((r) => r.type === 'EQUITY').map(line).filter((l) => l.amount !== 0);
  // No year-end closing entries are posted, so all profit to date sits in income/expense accounts.
  const earnings = Math.round(
    rows.filter((r) => r.type === 'INCOME' || r.type === 'EXPENSE').reduce((s, r) => s + (r.credit - r.debit), 0) * 100
  ) / 100;
  const sum = (ls: { amount: number }[]) => Math.round(ls.reduce((s, l) => s + l.amount, 0) * 100) / 100;
  const totalAssets = sum(assets);
  const totalLiabilities = sum(liabilities);
  const totalEquity = Math.round((sum(equity) + earnings) * 100) / 100;
  return {
    assets,
    liabilities,
    equity,
    earnings,
    totalAssets,
    totalLiabilities,
    totalEquity,
    difference: Math.round((totalAssets - totalLiabilities - totalEquity) * 100) / 100,
  };
}

export async function trialBalance(asOf: string) {
  const rows = await accountTotals({ to: asOf });
  const lines = rows
    .map((r) => {
      const net = Math.round((r.debit - r.credit) * 100) / 100;
      return { id: r.id, code: r.code, name: r.name, type: r.type, debit: net > 0 ? net : 0, credit: net < 0 ? -net : 0 };
    })
    .filter((l) => l.debit !== 0 || l.credit !== 0);
  const totalDebit = Math.round(lines.reduce((s, l) => s + l.debit, 0) * 100) / 100;
  const totalCredit = Math.round(lines.reduce((s, l) => s + l.credit, 0) * 100) / 100;
  return { lines, totalDebit, totalCredit };
}

/** Where a ledger line came from, as a link back to the document. */
export async function sourceLinks(entries: { sourceType: string | null; sourceId: string | null }[]) {
  const paymentIds = entries.filter((e) => e.sourceType === 'PAYMENT' && e.sourceId).map((e) => e.sourceId as string);
  const payments = paymentIds.length
    ? await prisma.payment.findMany({ where: { id: { in: paymentIds } }, select: { id: true, invoiceId: true } })
    : [];
  const payInv = new Map(payments.map((p) => [p.id, p.invoiceId]));
  return (sourceType: string | null, sourceId: string | null): { href: string; label: string } => {
    if (!sourceType) return { href: '/accounting/journal-entries', label: 'Journal entry' };
    const label = SOURCE_LABEL[sourceType as SourceType] ?? sourceType;
    switch (sourceType) {
      case 'INVOICE':
        return { href: `/billing/invoices/${sourceId}`, label };
      case 'PAYMENT':
        return { href: payInv.get(sourceId ?? '') ? `/billing/invoices/${payInv.get(sourceId ?? '')}` : '/billing', label };
      case 'SALES_RECEIPT':
        return { href: `/billing/sales-receipts/${sourceId}`, label };
      case 'REFUND_RECEIPT':
        return { href: '/billing/refund-receipts', label };
      case 'CREDIT_NOTE':
        return { href: '/billing/credit-notes', label };
      case 'BILL':
      case 'BILL_PAYMENT':
        return { href: '/expenses/bills', label };
      case 'EXPENSE':
        return { href: '/expenses', label };
      case 'TRANSFER':
        return { href: '/accounting/transfers', label };
      case 'DEPOSIT':
        return { href: '/accounting/deposits', label };
      case 'INVENTORY_ADJUSTMENT':
        return { href: '/inventory', label };
      default:
        return { href: '/accounting', label };
    }
  };
}
