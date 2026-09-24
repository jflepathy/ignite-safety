import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireEdit } from '@/lib/api-auth';
import { z } from 'zod';

/**
 * Session 22, round 10 — Transaction Reclassify (Tier 3 request #2),
 * QuickBooks' own "Reclassify Transactions" tool shape: pick a "from"
 * Chart-of-Accounts account, see every transaction currently coded to it,
 * multi-select, bulk-move to a "to" account.
 *
 * Scoped to the two account-coding fields that are genuinely safe to move
 * in bulk outside of double-entry bookkeeping: Expense.accountId and
 * BillLineItem.accountId. JournalLine.accountId is deliberately excluded
 * — it's one leg of a balanced double-entry journal entry, and reclassing
 * it in isolation (without touching its matching line) would silently
 * unbalance the journal. That's a separate, riskier feature if ever
 * wanted.
 *
 * Note: BillLineItem.accountId has no Prisma-level relation to Account (it
 * was modeled as a plain optional string column, not a declared foreign
 * key) — so it's filtered/updated here as a scalar field, and never
 * `include`d as a relation.
 */
export async function GET(req: NextRequest) {
  const { error } = await requireEdit('chartOfAccounts', 'ADMIN', 'SALES');
  if (error) return error;

  const fromAccountId = req.nextUrl.searchParams.get('fromAccountId');
  if (!fromAccountId) return NextResponse.json({ error: 'fromAccountId is required.' }, { status: 400 });
  const dateFrom = req.nextUrl.searchParams.get('dateFrom');
  const dateTo = req.nextUrl.searchParams.get('dateTo');
  const dateFilter =
    dateFrom || dateTo
      ? {
          ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
          ...(dateTo ? { lte: new Date(dateTo + 'T23:59:59.999Z') } : {}),
        }
      : undefined;

  const [expenses, billLineItems] = await Promise.all([
    prisma.expense.findMany({
      where: { accountId: fromAccountId, ...(dateFilter ? { date: dateFilter } : {}) },
      include: { supplier: true },
      orderBy: { date: 'desc' },
      take: 500,
    }),
    prisma.billLineItem.findMany({
      where: { accountId: fromAccountId, ...(dateFilter ? { bill: { billDate: dateFilter } } : {}) },
      include: { bill: { include: { supplier: true } } },
      orderBy: { id: 'desc' },
      take: 500,
    }),
  ]);

  return NextResponse.json({
    expenses: expenses.map((e) => ({
      id: e.id,
      date: e.date,
      description: e.description || e.category,
      vendor: e.supplier?.displayName ?? e.vendor ?? '—',
      reference: e.expenseNumber ?? e.reference ?? '—',
      amount: e.amount.toString(),
    })),
    billLineItems: billLineItems.map((li) => ({
      id: li.id,
      date: li.bill.billDate,
      description: li.description,
      vendor: li.bill.supplier.displayName,
      reference: li.bill.billNumber,
      amount: li.lineTotal.toString(),
    })),
  });
}

const ReclassifySchema = z.object({
  fromAccountId: z.string().min(1),
  toAccountId: z.string().min(1),
  expenseIds: z.array(z.string()).default([]),
  billLineItemIds: z.array(z.string()).default([]),
});

export async function POST(req: NextRequest) {
  const { session, error } = await requireEdit('chartOfAccounts', 'ADMIN', 'SALES');
  if (error) return error;

  const body = await req.json();
  const parsed = ReclassifySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { fromAccountId, toAccountId, expenseIds, billLineItemIds } = parsed.data;

  if (fromAccountId === toAccountId) {
    return NextResponse.json({ error: 'Pick a different account to move these to.' }, { status: 400 });
  }
  if (expenseIds.length === 0 && billLineItemIds.length === 0) {
    return NextResponse.json({ error: 'Select at least one transaction to reclassify.' }, { status: 400 });
  }

  const [fromAccount, toAccount] = await Promise.all([
    prisma.account.findUnique({ where: { id: fromAccountId } }),
    prisma.account.findUnique({ where: { id: toAccountId } }),
  ]);
  if (!fromAccount || !toAccount) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });

  // Sequential single-row update() calls, not updateMany() — confirmed by
  // direct testing against production that updateMany() itself (not just
  // $transaction()/upsert(), the two documented exceptions) gets wrapped
  // in an implicit transaction by this Prisma version's query engine,
  // which the Neon HTTP adapter can't run at all ("Transactions are not
  // supported in HTTP mode", a hard 500 on every call). See the same fix
  // applied to tax-rates/route.ts and tax-rates/[id]/route.ts, the only
  // other two updateMany() call sites in the app.
  //
  // Each row is re-checked against fromAccountId right before its own
  // update, so a row someone else already reclassified a moment ago (or
  // that came from a stale page) is silently skipped rather than
  // double-moved — the reported counts reflect what actually changed.
  let expensesMoved = 0;
  for (const id of expenseIds) {
    const row = await prisma.expense.findUnique({ where: { id } });
    if (row && row.accountId === fromAccountId) {
      await prisma.expense.update({ where: { id }, data: { accountId: toAccountId } });
      expensesMoved++;
    }
  }
  let billLineItemsMoved = 0;
  for (const id of billLineItemIds) {
    const row = await prisma.billLineItem.findUnique({ where: { id } });
    if (row && row.accountId === fromAccountId) {
      await prisma.billLineItem.update({ where: { id }, data: { accountId: toAccountId } });
      billLineItemsMoved++;
    }
  }
  const expenseResult = { count: expensesMoved };
  const billLineItemResult = { count: billLineItemsMoved };

  await prisma.auditLog.create({
    data: {
      userId: session!.user.id,
      action: 'TRANSACTIONS_RECLASSIFIED',
      entityType: 'Account',
      entityId: toAccountId,
      metadata: {
        fromAccount: `${fromAccount.code ?? ''} ${fromAccount.name}`.trim(),
        toAccount: `${toAccount.code ?? ''} ${toAccount.name}`.trim(),
        expensesMoved: expenseResult.count,
        billLineItemsMoved: billLineItemResult.count,
        expenseIds,
        billLineItemIds,
      },
    },
  });

  return NextResponse.json({
    ok: true,
    expensesMoved: expenseResult.count,
    billLineItemsMoved: billLineItemResult.count,
  });
}
