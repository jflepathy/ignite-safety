import { prisma } from '@/lib/prisma';
import { syncLedger, refreshBankBalances, type SourceType } from '@/lib/ledger';

/**
 * Bank reconciliation (accounting plan, Phase 3).
 *
 * Each imported statement line (BankTransaction) is matched to the document
 * that already records it in the books: an invoice payment, sales receipt,
 * expense, bill payment, refund, transfer or deposit on that bank account.
 *
 * Suggestions come in two flavours:
 *  - "match": the document is already on this bank account.
 *  - "move":  the same amount was recorded on another cash account (e.g. Petty
 *    Cash, or Undeposited Funds) — matching moves it to this bank. This is how
 *    card / transfer receipts that actually landed in Absa get settled.
 * Lines with no document can be turned into one (expense, invoice payment,
 * bill payment, transfer, or a journal to any account).
 */

export type Candidate = {
  type: SourceType;
  id: string;
  date: Date;
  amount: number; // signed like the bank line: + money in
  label: string;
  bankAccountId: string | null; // where it is recorded now (null = Undeposited Funds / n.a.)
  bankName: string;
  mode: 'match' | 'move';
  score: number;
};

const DAY = 24 * 3600 * 1000;
const r2 = (n: number) => Math.round(n * 100) / 100;
const words = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3)
  );

/** Documents already matched to some bank line (so they aren't offered twice). */
async function matchedKeys(): Promise<Set<string>> {
  const rows = await prisma.bankTransaction.findMany({ where: { matchType: { not: null } }, select: { matchType: true, matchId: true } });
  return new Set(rows.map((r) => `${r.matchType}:${r.matchId}`));
}

/**
 * Candidate documents for a set of bank lines on one bank account.
 * One query per document type regardless of how many lines are passed.
 */
export async function findCandidates(
  bankAccountId: string,
  lines: { id: string; date: Date; amount: number; description: string; reference?: string | null }[]
): Promise<Map<string, Candidate[]>> {
  const out = new Map<string, Candidate[]>();
  if (!lines.length) return out;
  const bank = await prisma.bankAccount.findUnique({ where: { id: bankAccountId } });
  if (!bank) return out;
  const amounts = [...new Set(lines.map((l) => Math.abs(r2(l.amount))))];
  const min = new Date(Math.min(...lines.map((l) => l.date.getTime())) - 21 * DAY);
  const max = new Date(Math.max(...lines.map((l) => l.date.getTime())) + 21 * DAY);
  const banks = await prisma.bankAccount.findMany({ select: { id: true, name: true, accountId: true } });
  const bankName = (id: string | null) => (id ? banks.find((b) => b.id === id)?.name ?? 'Other account' : 'Undeposited Funds');
  const done = await matchedKeys();

  const [payments, receipts, expenses, billPays, refunds, transfers, deposits] = await Promise.all([
    prisma.payment.findMany({
      where: { amount: { in: amounts }, paidAt: { gte: min, lte: max }, verificationStatus: { in: ['NONE', 'CONFIRMED'] } },
      include: { invoice: { select: { invoiceNumber: true, customer: { select: { displayName: true } } } } },
    }),
    prisma.salesReceipt.findMany({ where: { total: { in: amounts }, saleDate: { gte: min, lte: max } }, include: { customer: { select: { displayName: true } } } }),
    prisma.expense.findMany({ where: { amount: { in: amounts }, date: { gte: min, lte: max } }, include: { supplier: { select: { displayName: true } } } }),
    prisma.supplierPayment.findMany({
      where: { amount: { in: amounts }, paidAt: { gte: min, lte: max } },
      include: { bill: { select: { billNumber: true, supplier: { select: { displayName: true } } } } },
    }),
    prisma.refundReceipt.findMany({ where: { total: { in: amounts }, refundDate: { gte: min, lte: max } }, include: { customer: { select: { displayName: true } } } }),
    prisma.accountTransfer.findMany({
      where: { amount: { in: amounts }, date: { gte: min, lte: max }, OR: [{ fromAccountId: bank.accountId }, { toAccountId: bank.accountId }] },
      include: { fromAccount: true, toAccount: true },
    }),
    prisma.deposit.findMany({ where: { amount: { in: amounts }, date: { gte: min, lte: max }, bankAccountId }, include: { bankAccount: true } }),
  ]);

  // Money in (+) and money out (-) pools.
  const pool: Omit<Candidate, 'mode' | 'score'>[] = [
    ...payments.map((p) => ({
      type: 'PAYMENT' as const,
      id: p.id,
      date: p.paidAt,
      amount: Number(p.amount),
      label: `Payment · Invoice ${p.invoice.invoiceNumber} · ${p.invoice.customer.displayName}${p.reference ? ` · ${p.reference}` : ''}`,
      bankAccountId: p.bankAccountId,
      bankName: bankName(p.bankAccountId),
    })),
    ...receipts.map((r) => ({
      type: 'SALES_RECEIPT' as const,
      id: r.id,
      date: r.saleDate,
      amount: Number(r.total),
      label: `Sales receipt ${r.receiptNumber} · ${r.customer.displayName} · ${r.paymentMethod.replace('_', ' ').toLowerCase()}`,
      bankAccountId: r.bankAccountId,
      bankName: bankName(r.bankAccountId),
    })),
    ...expenses.map((e) => ({
      type: 'EXPENSE' as const,
      id: e.id,
      date: e.date,
      amount: -Number(e.amount),
      label: `Expense ${e.expenseNumber ?? ''} · ${e.supplier?.displayName ?? e.vendor ?? e.category}${e.description ? ` · ${e.description}` : ''}`,
      bankAccountId: e.bankAccountId,
      bankName: bankName(e.bankAccountId),
    })),
    ...billPays.map((p) => ({
      type: 'BILL_PAYMENT' as const,
      id: p.id,
      date: p.paidAt,
      amount: -Number(p.amount),
      label: `Bill payment · ${p.bill.billNumber} · ${p.bill.supplier.displayName}`,
      bankAccountId: p.bankAccountId,
      bankName: bankName(p.bankAccountId),
    })),
    ...refunds.map((r) => ({
      type: 'REFUND_RECEIPT' as const,
      id: r.id,
      date: r.refundDate,
      amount: -Number(r.total),
      label: `Refund ${r.refundNumber} · ${r.customer.displayName}`,
      bankAccountId: r.bankAccountId,
      bankName: bankName(r.bankAccountId),
    })),
    ...transfers.map((t) => ({
      type: 'TRANSFER' as const,
      id: t.id,
      date: t.date,
      amount: t.toAccountId === bank.accountId ? Number(t.amount) : -Number(t.amount),
      label: `Transfer ${t.fromAccount.name} → ${t.toAccount.name}${t.memo ? ` · ${t.memo}` : ''}`,
      bankAccountId,
      bankName: bank.name,
    })),
    ...deposits.map((d) => ({
      type: 'DEPOSIT' as const,
      id: d.id,
      date: d.date,
      amount: Number(d.amount),
      label: `Deposit${d.memo ? ` · ${d.memo}` : ''}`,
      bankAccountId,
      bankName: bank.name,
    })),
  ].filter((c) => !done.has(`${c.type}:${c.id}`));

  for (const l of lines) {
    const lw = words(`${l.description} ${l.reference ?? ''}`);
    const cands: Candidate[] = [];
    for (const c of pool) {
      if (Math.abs(r2(c.amount) - r2(l.amount)) > 0.004) continue;
      const days = Math.abs(c.date.getTime() - l.date.getTime()) / DAY;
      if (days > 21) continue;
      const mode: 'match' | 'move' = c.bankAccountId === bankAccountId ? 'match' : 'move';
      // Transfers and deposits only count when on this very bank.
      if (mode === 'move' && (c.type === 'TRANSFER' || c.type === 'DEPOSIT')) continue;
      const overlap = [...words(c.label)].filter((w) => lw.has(w)).length;
      const score = (mode === 'match' ? 50 : 30) + Math.max(0, 20 - days * 2) + Math.min(overlap, 5) * 4;
      cands.push({ ...c, mode, score });
    }
    out.set(l.id, cands.sort((a, b) => b.score - a.score).slice(0, 5));
  }
  return out;
}

/** Point a document at a different bank / cash account (used by "move & match"). */
async function moveDocument(type: SourceType, id: string, bankAccountId: string) {
  switch (type) {
    case 'PAYMENT':
      await prisma.payment.update({ where: { id }, data: { bankAccountId } });
      break;
    case 'SALES_RECEIPT':
      await prisma.salesReceipt.update({ where: { id }, data: { bankAccountId } });
      break;
    case 'EXPENSE':
      await prisma.expense.update({ where: { id }, data: { bankAccountId } });
      break;
    case 'BILL_PAYMENT':
      await prisma.supplierPayment.update({ where: { id }, data: { bankAccountId } });
      break;
    case 'REFUND_RECEIPT':
      await prisma.refundReceipt.update({ where: { id }, data: { bankAccountId } });
      break;
    default:
      throw new Error('This kind of entry cannot be moved to another account.');
  }
  // If it was sitting in a deposit, take it out (it is now banked directly).
  if (type === 'PAYMENT' || type === 'SALES_RECEIPT') {
    const field = type === 'PAYMENT' ? 'paymentIds' : 'receiptIds';
    const deps = await prisma.deposit.findMany({ select: { id: true, paymentIds: true, receiptIds: true, amount: true } });
    for (const d of deps) {
      const ids = (Array.isArray(d[field]) ? d[field] : []) as string[];
      if (ids.includes(id)) {
        await prisma.deposit.update({ where: { id: d.id }, data: { [field]: ids.filter((x) => x !== id) } as any });
      }
    }
  }
}

export async function markMatched(txnId: string, type: string, id: string) {
  await prisma.bankTransaction.update({
    where: { id: txnId },
    data: { matchType: type, matchId: id, matchedAt: new Date(), reconciled: true, excluded: false },
  });
}

/** Match a bank line to a document, moving the document onto this bank first if needed. */
export async function matchLine(txnId: string, type: SourceType, id: string) {
  const txn = await prisma.bankTransaction.findUnique({ where: { id: txnId } });
  if (!txn) throw new Error('Bank line not found.');
  const cands = (await findCandidates(txn.bankAccountId, [{ id: txn.id, date: txn.date, amount: Number(txn.amount), description: txn.description, reference: txn.reference }])).get(txn.id) ?? [];
  const c = cands.find((x) => x.type === type && x.id === id);
  if (!c) throw new Error('That entry no longer matches this bank line (amount, date or already matched).');
  if (c.mode === 'move') {
    await moveDocument(type, id, txn.bankAccountId);
    await syncLedger([{ type, id }]);
  }
  await markMatched(txn.id, type, id);
  return c;
}

/**
 * Auto-match: every unmatched line on this bank with exactly one candidate that
 * is already on this bank and dated within 5 days is matched. Moves are never
 * automatic.
 */
export async function autoMatch(bankAccountId: string): Promise<number> {
  const open = await prisma.bankTransaction.findMany({
    where: { bankAccountId, matchType: null, excluded: false },
    orderBy: { date: 'asc' },
    take: 400,
  });
  const cands = await findCandidates(
    bankAccountId,
    open.map((t) => ({ id: t.id, date: t.date, amount: Number(t.amount), description: t.description, reference: t.reference }))
  );
  const used = new Set<string>();
  const picks: { txnId: string; type: string; id: string }[] = [];
  for (const t of open) {
    const sure = (cands.get(t.id) ?? []).filter(
      (c) => c.mode === 'match' && Math.abs(c.date.getTime() - t.date.getTime()) <= 5 * DAY && !used.has(`${c.type}:${c.id}`)
    );
    if (sure.length !== 1) continue;
    used.add(`${sure[0].type}:${sure[0].id}`);
    picks.push({ txnId: t.id, type: sure[0].type, id: sure[0].id });
  }
  // One bulk UPDATE (Workers subrequest budget).
  for (let i = 0; i < picks.length; i += 300) {
    const chunk = picks.slice(i, i + 300);
    const params: any[] = [];
    const values = chunk.map((p) => {
      const b = params.length;
      params.push(p.txnId, p.type, p.id);
      return `($${b + 1},$${b + 2},$${b + 3})`;
    });
    await prisma.$executeRawUnsafe(
      `UPDATE "bank_transactions" AS b SET "matchType" = v.t, "matchId" = v.i, "matchedAt" = now(), "reconciled" = true, "excluded" = false
         FROM (VALUES ${values.join(',')}) AS v(id, t, i) WHERE b."id" = v.id`,
      ...params
    );
  }
  const n = picks.length;
  return n;
}

export { refreshBankBalances };
