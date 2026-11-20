import { prisma } from '@/lib/prisma';

/**
 * General ledger auto-posting (accounting plan, Nov 2026).
 *
 * Every money document (invoice, payment, sales receipt, refund, credit note,
 * bill, bill payment, expense, transfer, deposit, inventory adjustment, bank
 * opening balance) is turned into ONE balanced journal entry tagged with its
 * source (`sourceType` + `sourceId`). Posting is idempotent: re-posting a
 * document deletes its previous entry and writes the new one, so a document
 * that is edited, voided or deleted simply gets re-synced.
 *
 * The Neon HTTP adapter has no transactions and a Worker invocation allows
 * ~50 subrequests, so entries are written with a handful of bulk SQL
 * statements (one delete, one multi-row insert for entries, one for lines)
 * rather than one query per row. If a sync ever fails half-way, the nightly
 * rebuild (cron job "ledger") re-posts everything from the documents, which
 * are the source of truth.
 *
 * Basis: accrual. Invoices hit A/R and income when issued (drafts are not
 * posted); payments move A/R to the bank; sales receipts and refunds hit the
 * bank (or Undeposited Funds) directly.
 *
 * Bank balances (BankAccount.currentBalance) are derived from the ledger by
 * refreshBankBalances() after every sync.
 */

export const SOURCE_TYPES = [
  'BANK_OPENING',
  'INVOICE',
  'PAYMENT',
  'SALES_RECEIPT',
  'REFUND_RECEIPT',
  'CREDIT_NOTE',
  'BILL',
  'BILL_PAYMENT',
  'EXPENSE',
  'TRANSFER',
  'DEPOSIT',
  'INVENTORY_ADJUSTMENT',
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const SOURCE_LABEL: Record<SourceType, string> = {
  BANK_OPENING: 'Bank opening balance',
  INVOICE: 'Invoice',
  PAYMENT: 'Payment',
  SALES_RECEIPT: 'Sales receipt',
  REFUND_RECEIPT: 'Refund receipt',
  CREDIT_NOTE: 'Credit note',
  BILL: 'Bill',
  BILL_PAYMENT: 'Bill payment',
  EXPENSE: 'Expense',
  TRANSFER: 'Transfer',
  DEPOSIT: 'Deposit',
  INVENTORY_ADJUSTMENT: 'Inventory adjustment',
};

/** Fixed accounts the posting rules rely on, by Chart of Accounts code. */
export const CODES = {
  AR: '1100',
  INVENTORY: '1200',
  UNDEPOSITED: '1210',
  VAT_IN: '1220',
  AP: '2000',
  VAT_OUT: '2110',
  OPENING_EQUITY: '3000',
  RETAINED_EARNINGS: '3100',
  SALES_PRODUCT: '4000',
  SERVICES: '4100',
  UNCATEGORISED_INCOME: '4300',
  SHRINKAGE: '5020',
  OTHER_EXPENSE: '6110',
  PURCHASES: '6130',
} as const;

type Line = { accountId: string; debit: number; credit: number; description?: string | null };
export type BuiltEntry = { sourceType: SourceType; sourceId: string; date: Date; memo: string; lines: Line[] };

type Ctx = {
  code: (c: string) => string;
  bankAcc: (bankAccountId: string | null | undefined) => string;
};

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const num = (d: any) => (d == null ? 0 : Number(d));

async function loadCtx(): Promise<Ctx> {
  const [accounts, banks] = await Promise.all([
    prisma.account.findMany({ where: { code: { not: null } }, select: { id: true, code: true } }),
    prisma.bankAccount.findMany({ select: { id: true, accountId: true } }),
  ]);
  const byCode = new Map(accounts.map((a) => [a.code as string, a.id]));
  const bankMap = new Map(banks.map((b) => [b.id, b.accountId]));
  const code = (c: string) => {
    const id = byCode.get(c);
    if (!id) throw new Error(`Chart of Accounts is missing account ${c} needed for posting`);
    return id;
  };
  return {
    code,
    bankAcc: (bankAccountId) => (bankAccountId && bankMap.get(bankAccountId)) || code(CODES.UNDEPOSITED),
  };
}

/** Debit (positive) / credit (negative) helper that handles negative amounts. */
class EntryBuilder {
  lines: Line[] = [];
  dr(accountId: string, amount: number, description?: string | null) {
    const a = r2(amount);
    if (a === 0) return this;
    this.lines.push(a > 0 ? { accountId, debit: a, credit: 0, description } : { accountId, debit: 0, credit: -a, description });
    return this;
  }
  cr(accountId: string, amount: number, description?: string | null) {
    return this.dr(accountId, -amount, description);
  }
  /** Merge lines on the same account+side and make sure the entry balances. */
  finish(): Line[] {
    const merged = new Map<string, Line>();
    for (const l of this.lines) {
      const side = l.debit > 0 ? 'D' : 'C';
      const k = `${l.accountId}|${side}|${l.description ?? ''}`;
      const m = merged.get(k);
      if (m) {
        m.debit = r2(m.debit + l.debit);
        m.credit = r2(m.credit + l.credit);
      } else merged.set(k, { ...l });
    }
    const out = [...merged.values()];
    const diff = r2(out.reduce((s, l) => s + l.debit - l.credit, 0));
    if (diff !== 0 && out.length) {
      // Rounding residue (never more than a few cents): absorb it on the largest line.
      const target = [...out].sort((a, b) => Math.max(b.debit, b.credit) - Math.max(a.debit, a.credit))[0];
      if (target.credit > 0) target.credit = r2(target.credit + diff);
      else target.debit = r2(target.debit - diff);
    }
    return out.filter((l) => l.debit !== 0 || l.credit !== 0);
  }
}

/** Split `total` across `weights` so the parts sum exactly to `total`. */
function allocate(total: number, weights: number[]): number[] {
  const t = r2(total);
  const w = weights.map((x) => (x > 0 ? x : 0));
  const sum = w.reduce((a, b) => a + b, 0);
  if (sum === 0) return weights.map((_, i) => (i === 0 ? t : 0));
  const parts = w.map((x) => r2((t * x) / sum));
  const residue = r2(t - parts.reduce((a, b) => a + b, 0));
  const big = w.indexOf(Math.max(...w));
  parts[big] = r2(parts[big] + residue);
  return parts;
}

type SaleLine = { lineTotal: any; quantity: any; shopItem?: { itemType: string; incomeAccountId: string | null } | null };

function incomeAccountFor(ctx: Ctx, li: SaleLine) {
  if (li.shopItem?.incomeAccountId) return li.shopItem.incomeAccountId;
  if (li.shopItem) return ctx.code(li.shopItem.itemType === 'SERVICE' ? CODES.SERVICES : CODES.SALES_PRODUCT);
  return ctx.code(CODES.UNCATEGORISED_INCOME);
}

/** Income side of a sale-type document: net (ex-tax) amount split by line, credited (sign=+1) or debited (sign=-1). */
function postIncome(b: EntryBuilder, ctx: Ctx, lines: SaleLine[], net: number, sign: 1 | -1, desc: string) {
  const usable = lines.filter((l) => num(l.lineTotal) !== 0);
  if (usable.length === 0) {
    b.cr(ctx.code(CODES.UNCATEGORISED_INCOME), sign * net, desc);
    return;
  }
  const parts = allocate(net, usable.map((l) => num(l.lineTotal)));
  usable.forEach((l, i) => b.cr(incomeAccountFor(ctx, l), sign * parts[i], desc));
}

const lineInclude = { lineItems: { include: { shopItem: { select: { itemType: true, incomeAccountId: true } } } } } as const;

// ---------------------------------------------------------------------------
// Builders: load documents of one type (all, or by id) and build their entries
// ---------------------------------------------------------------------------

async function build(type: SourceType, ids: string[] | null, ctx: Ctx): Promise<{ entries: BuiltEntry[]; keys: string[] }> {
  const whereIds = ids ? { id: { in: ids } } : {};
  const entries: BuiltEntry[] = [];
  const keys: string[] = ids ? ids.slice() : [];
  const push = (sourceId: string, date: Date, memo: string, b: EntryBuilder) => {
    const lines = b.finish();
    if (lines.length) entries.push({ sourceType: type, sourceId, date, memo, lines });
  };

  switch (type) {
    case 'BANK_OPENING': {
      const rows = await prisma.bankAccount.findMany({ where: whereIds });
      for (const r of rows) {
        const b = new EntryBuilder().dr(r.accountId, num(r.openingBalance), 'Opening balance').cr(ctx.code(CODES.OPENING_EQUITY), num(r.openingBalance), r.name);
        push(r.id, r.createdAt, `Opening balance · ${r.name}`, b);
      }
      break;
    }
    case 'INVOICE': {
      const rows = await prisma.invoice.findMany({ where: whereIds, include: { ...lineInclude, customer: { select: { displayName: true } } } });
      for (const r of rows) {
        if (r.deletedAt || r.status === 'DRAFT' || r.status === 'VOID') continue;
        const total = num(r.total);
        const tax = num(r.taxTotal);
        const desc = `Invoice ${r.invoiceNumber} · ${r.customer.displayName}`;
        const b = new EntryBuilder().dr(ctx.code(CODES.AR), total, desc);
        if (r.invoiceNumber.startsWith('OB-')) {
          b.cr(ctx.code(CODES.OPENING_EQUITY), total - tax, desc); // opening A/R brought forward
        } else {
          postIncome(b, ctx, r.lineItems, total - tax, 1, desc);
        }
        b.cr(ctx.code(CODES.VAT_OUT), tax, desc);
        push(r.id, r.issueDate, desc, b);
      }
      break;
    }
    case 'PAYMENT': {
      const rows = await prisma.payment.findMany({
        where: whereIds,
        include: { invoice: { select: { invoiceNumber: true, customer: { select: { displayName: true } } } } },
      });
      for (const r of rows) {
        if (r.verificationStatus === 'PENDING_REVIEW' || r.verificationStatus === 'MISMATCH') continue;
        const desc = `Payment · ${r.invoice.invoiceNumber} · ${r.invoice.customer.displayName}`;
        const b = new EntryBuilder().dr(ctx.bankAcc(r.bankAccountId), num(r.amount), desc).cr(ctx.code(CODES.AR), num(r.amount), desc);
        push(r.id, r.paidAt, `${desc} (${r.method.replace('_', ' ').toLowerCase()})`, b);
      }
      break;
    }
    case 'SALES_RECEIPT': {
      const rows = await prisma.salesReceipt.findMany({ where: whereIds, include: { ...lineInclude, customer: { select: { displayName: true } } } });
      for (const r of rows) {
        const total = num(r.total);
        const tax = num(r.taxTotal);
        const desc = `Sales receipt ${r.receiptNumber} · ${r.customer.displayName}`;
        const b = new EntryBuilder().dr(ctx.bankAcc(r.bankAccountId), total, desc);
        postIncome(b, ctx, r.lineItems, total - tax, 1, desc);
        b.cr(ctx.code(CODES.VAT_OUT), tax, desc);
        push(r.id, r.saleDate, desc, b);
      }
      break;
    }
    case 'REFUND_RECEIPT': {
      const rows = await prisma.refundReceipt.findMany({ where: whereIds, include: { ...lineInclude, customer: { select: { displayName: true } } } });
      for (const r of rows) {
        const total = num(r.total);
        const tax = num(r.taxTotal);
        const desc = `Refund ${r.refundNumber} · ${r.customer.displayName}`;
        const b = new EntryBuilder();
        postIncome(b, ctx, r.lineItems, total - tax, -1, desc);
        b.dr(ctx.code(CODES.VAT_OUT), tax, desc).cr(ctx.bankAcc(r.bankAccountId), total, desc);
        push(r.id, r.refundDate, desc, b);
      }
      break;
    }
    case 'CREDIT_NOTE': {
      const rows = await prisma.creditNote.findMany({ where: whereIds, include: { ...lineInclude, customer: { select: { displayName: true } } } });
      for (const r of rows) {
        if (r.status === 'DRAFT' || r.status === 'VOID') continue;
        const total = num(r.total);
        const tax = num(r.taxTotal);
        const desc = `Credit note ${r.creditNoteNumber} · ${r.customer.displayName}`;
        const b = new EntryBuilder();
        postIncome(b, ctx, r.lineItems, total - tax, -1, desc);
        b.dr(ctx.code(CODES.VAT_OUT), tax, desc).cr(ctx.code(CODES.AR), total, desc);
        push(r.id, r.issueDate, desc, b);
      }
      break;
    }
    case 'BILL': {
      const rows = await prisma.bill.findMany({
        where: whereIds,
        include: { supplier: { select: { displayName: true } }, billLineItems: { include: { shopItem: { select: { expenseAccountId: true } } } } },
      });
      for (const r of rows) {
        if (r.status === 'VOID') continue;
        const total = num(r.total);
        const tax = num(r.taxTotal);
        const desc = `Bill ${r.billNumber} · ${r.supplier.displayName}`;
        const b = new EntryBuilder();
        if (r.billNumber.startsWith('OB-')) {
          b.dr(ctx.code(CODES.OPENING_EQUITY), total - tax, desc); // opening A/P brought forward
        } else {
          const lines = r.billLineItems.filter((l) => num(l.lineTotal) !== 0);
          if (lines.length === 0) b.dr(ctx.code(CODES.PURCHASES), total - tax, desc);
          else {
            const parts = allocate(total - tax, lines.map((l) => num(l.lineTotal)));
            lines.forEach((l, i) => b.dr(l.accountId || l.shopItem?.expenseAccountId || ctx.code(CODES.PURCHASES), parts[i], desc));
          }
        }
        b.dr(ctx.code(CODES.VAT_IN), tax, desc).cr(ctx.code(CODES.AP), total, desc);
        push(r.id, r.billDate, desc, b);
      }
      break;
    }
    case 'BILL_PAYMENT': {
      const rows = await prisma.supplierPayment.findMany({
        where: whereIds,
        include: { bill: { select: { billNumber: true, supplier: { select: { displayName: true } } } } },
      });
      for (const r of rows) {
        const desc = `Bill payment · ${r.bill.billNumber} · ${r.bill.supplier.displayName}`;
        const b = new EntryBuilder().dr(ctx.code(CODES.AP), num(r.amount), desc).cr(ctx.bankAcc(r.bankAccountId), num(r.amount), desc);
        push(r.id, r.paidAt, desc, b);
      }
      break;
    }
    case 'EXPENSE': {
      const rows = await prisma.expense.findMany({ where: whereIds, include: { supplier: { select: { displayName: true } } } });
      for (const r of rows) {
        const who = r.supplier?.displayName ?? r.vendor ?? '';
        const desc = `Expense ${r.expenseNumber ?? ''}${who ? ` · ${who}` : ''}${r.description ? ` · ${r.description}` : ''}`.trim();
        const b = new EntryBuilder()
          .dr(r.accountId || ctx.code(CODES.OTHER_EXPENSE), num(r.amount), desc)
          .cr(ctx.bankAcc(r.bankAccountId), num(r.amount), desc);
        push(r.id, r.date, desc, b);
      }
      break;
    }
    case 'TRANSFER': {
      const rows = await prisma.accountTransfer.findMany({ where: whereIds, include: { fromAccount: true, toAccount: true } });
      for (const r of rows) {
        const desc = `Transfer ${r.fromAccount.name} → ${r.toAccount.name}${r.memo ? ` · ${r.memo}` : ''}`;
        const b = new EntryBuilder().dr(r.toAccountId, num(r.amount), desc).cr(r.fromAccountId, num(r.amount), desc);
        push(r.id, r.date, desc, b);
      }
      break;
    }
    case 'DEPOSIT': {
      const rows = await prisma.deposit.findMany({ where: whereIds, include: { bankAccount: true } });
      for (const r of rows) {
        const desc = `Deposit to ${r.bankAccount.name}${r.memo ? ` · ${r.memo}` : ''}`;
        const b = new EntryBuilder().dr(r.bankAccount.accountId, num(r.amount), desc).cr(ctx.code(CODES.UNDEPOSITED), num(r.amount), desc);
        push(r.id, r.date, desc, b);
      }
      break;
    }
    case 'INVENTORY_ADJUSTMENT': {
      const rows = await prisma.inventoryAdjustment.findMany({ where: whereIds, include: { shopItem: true } });
      for (const r of rows) {
        const value = r.quantityChange * num(r.shopItem.cost);
        const desc = `Stock adjustment · ${r.shopItem.sku} ${r.shopItem.name} (${r.quantityChange > 0 ? '+' : ''}${r.quantityChange})`;
        const b = new EntryBuilder().dr(ctx.code(CODES.INVENTORY), value, desc).cr(ctx.code(CODES.SHRINKAGE), value, desc);
        push(r.id, r.date, desc, b);
      }
      break;
    }
  }
  if (!ids) for (const e of entries) keys.push(e.sourceId);
  return { entries, keys };
}

// ---------------------------------------------------------------------------
// Persistence (bulk SQL, a handful of subrequests regardless of batch size)
// ---------------------------------------------------------------------------

const uid = () => `je${crypto.randomUUID().replace(/-/g, '').slice(0, 23)}`;

async function writeEntries(type: SourceType, entries: BuiltEntry[], deleteIds: string[] | 'ALL') {
  if (deleteIds === 'ALL') {
    await prisma.$executeRawUnsafe(`DELETE FROM "journal_entries" WHERE "sourceType" = $1`, type);
  } else {
    for (let i = 0; i < deleteIds.length; i += 500) {
      const chunk = deleteIds.slice(i, i + 500);
      const ph = chunk.map((_, j) => `$${j + 2}`).join(',');
      await prisma.$executeRawUnsafe(`DELETE FROM "journal_entries" WHERE "sourceType" = $1 AND "sourceId" IN (${ph})`, type, ...chunk);
    }
  }
  if (!entries.length) return;
  const now = new Date();
  const withIds = entries.map((e) => ({ ...e, id: uid() }));
  for (let i = 0; i < withIds.length; i += 200) {
    const chunk = withIds.slice(i, i + 200);
    const params: any[] = [];
    const values = chunk.map((e) => {
      const b = params.length;
      params.push(e.id, `A-${e.sourceType}-${e.sourceId}`, e.date, e.memo.slice(0, 500), e.sourceType, e.sourceId, now);
      return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7})`;
    });
    await prisma.$executeRawUnsafe(
      `INSERT INTO "journal_entries" ("id","entryNumber","date","memo","sourceType","sourceId","createdAt") VALUES ${values.join(',')}`,
      ...params
    );
  }
  const lines = withIds.flatMap((e) => e.lines.map((l) => ({ ...l, entryId: e.id })));
  for (let i = 0; i < lines.length; i += 400) {
    const chunk = lines.slice(i, i + 400);
    const params: any[] = [];
    const values = chunk.map((l) => {
      const b = params.length;
      params.push(uid(), l.entryId, l.accountId, l.debit, l.credit, l.description ? l.description.slice(0, 300) : null);
      return `($${b + 1},$${b + 2},$${b + 3},$${b + 4}::numeric,$${b + 5}::numeric,$${b + 6})`;
    });
    await prisma.$executeRawUnsafe(
      `INSERT INTO "journal_lines" ("id","journalEntryId","accountId","debit","credit","description") VALUES ${values.join(',')}`,
      ...params
    );
  }
}

/** Bank / cash balances = their Chart of Accounts balance in the ledger. One statement. */
export async function refreshBankBalances() {
  await prisma.$executeRawUnsafe(
    `UPDATE "bank_accounts" b SET "currentBalance" = COALESCE((SELECT SUM(l."debit" - l."credit") FROM "journal_lines" l WHERE l."accountId" = b."accountId"), 0)`
  );
}

/**
 * Re-post specific documents (call after creating / editing / deleting them).
 * Best effort: never throws, so a ledger hiccup can't break the business action;
 * the nightly rebuild repairs anything missed.
 */
export async function syncLedger(refs: { type: SourceType; id: string }[]): Promise<{ ok: boolean; error?: string }> {
  try {
    const ctx = await loadCtx();
    const byType = new Map<SourceType, string[]>();
    for (const r of refs) byType.set(r.type, [...(byType.get(r.type) ?? []), r.id]);
    for (const [type, ids] of byType) {
      const { entries } = await build(type, ids, ctx);
      await writeEntries(type, entries, ids);
    }
    await refreshBankBalances();
    return { ok: true };
  } catch (e: any) {
    console.error('[ledger] sync failed', e?.message ?? e);
    return { ok: false, error: e?.message ?? String(e) };
  }
}

/** Re-post every document of the given types from scratch (rebuild tool + nightly job). */
export async function rebuildLedgerTypes(types: SourceType[]): Promise<{ type: SourceType; entries: number; lines: number }[]> {
  const ctx = await loadCtx();
  const out: { type: SourceType; entries: number; lines: number }[] = [];
  for (const type of types) {
    const { entries } = await build(type, null, ctx);
    await writeEntries(type, entries, 'ALL');
    out.push({ type, entries: entries.length, lines: entries.reduce((s, e) => s + e.lines.length, 0) });
  }
  await refreshBankBalances();
  return out;
}

/** The nightly rebuild runs in three parts so each stays well inside the Worker subrequest limit. */
export const REBUILD_PARTS: SourceType[][] = [
  ['BANK_OPENING', 'INVOICE', 'PAYMENT', 'SALES_RECEIPT'],
  ['REFUND_RECEIPT', 'CREDIT_NOTE', 'BILL', 'BILL_PAYMENT'],
  ['EXPENSE', 'TRANSFER', 'DEPOSIT', 'INVENTORY_ADJUSTMENT'],
];
