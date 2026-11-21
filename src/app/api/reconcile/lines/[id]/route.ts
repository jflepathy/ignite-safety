import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { z } from 'zod';
import { matchLine, markMatched, refreshBankBalances } from '@/lib/reconcile';
import { syncLedger, SOURCE_TYPES, type SourceType } from '@/lib/ledger';
import { closedPeriodResponse } from '@/lib/period-lock';
import { nextDocumentNumber } from '@/lib/numbering';
import { recomputeInvoiceBalance } from '@/lib/invoice-balance';

/**
 * Actions on one imported bank statement line (accounting plan, Phase 3):
 *   match            link it to an existing document (moves it onto this bank if needed)
 *   unmatch          undo the link (the document stays)
 *   exclude/include  leave a line out of the reconciliation (e.g. a duplicate)
 *   expense          record a new expense paid from this bank (money out)
 *   payment          record a payment against an open invoice (money in)
 *   bill-payment     record a payment of an open bill (money out)
 *   transfer         record a transfer between this bank and another account
 *   journal          post it against any account (e.g. other income, owner money)
 */
const Schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('match'), type: z.enum(SOURCE_TYPES), id: z.string().min(1) }),
  z.object({ action: z.literal('unmatch') }),
  z.object({ action: z.literal('exclude'), note: z.string().max(300).optional() }),
  z.object({ action: z.literal('include') }),
  z.object({
    action: z.literal('expense'),
    accountId: z.string().min(1),
    description: z.string().max(300).optional(),
    supplierId: z.string().optional().nullable(),
  }),
  z.object({ action: z.literal('payment'), invoiceId: z.string().min(1) }),
  z.object({ action: z.literal('bill-payment'), billId: z.string().min(1) }),
  z.object({ action: z.literal('transfer'), accountId: z.string().min(1), memo: z.string().max(300).optional() }),
  z.object({ action: z.literal('journal'), accountId: z.string().min(1), memo: z.string().max(300).optional() }),
]);

const bad = (msg: string, status = 400) => NextResponse.json({ error: { formErrors: [msg] }, message: msg }, { status });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;
  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const a = parsed.data;
  const txn = await prisma.bankTransaction.findUnique({ where: { id: params.id }, include: { bankAccount: true } });
  if (!txn) return bad('Bank line not found.', 404);
  const amt = Number(txn.amount);
  const abs = Math.abs(amt);

  if (a.action === 'unmatch') {
    await prisma.bankTransaction.update({ where: { id: txn.id }, data: { matchType: null, matchId: null, matchedAt: null, reconciled: false } });
    return NextResponse.json({ ok: true });
  }
  if (a.action === 'exclude') {
    await prisma.bankTransaction.update({ where: { id: txn.id }, data: { excluded: true, reconciled: true, note: a.note ?? null, matchType: null, matchId: null } });
    return NextResponse.json({ ok: true });
  }
  if (a.action === 'include') {
    await prisma.bankTransaction.update({ where: { id: txn.id }, data: { excluded: false, reconciled: false } });
    return NextResponse.json({ ok: true });
  }
  if (txn.matchType) return bad('This line is already matched. Unmatch it first.', 409);

  if (a.action === 'match') {
    try {
      await matchLine(txn.id, a.type as SourceType, a.id);
    } catch (e: any) {
      return bad(e?.message ?? 'Could not match.', 409);
    }
    return NextResponse.json({ ok: true });
  }

  // Everything below creates a new entry dated on the bank line's date.
  const locked = await closedPeriodResponse(txn.date);
  if (locked) return locked;
  const memoBase = `${txn.description}${txn.reference ? ` (${txn.reference})` : ''}`.slice(0, 250);

  if (a.action === 'expense') {
    if (amt > 0) return bad('An expense is money out; this line is money in.');
    const account = await prisma.account.findUnique({ where: { id: a.accountId } });
    if (!account || account.type !== 'EXPENSE') return bad('Pick an expense account.');
    const expenseNumber = await nextDocumentNumber('expenseNextSeq', 'expensePrefix');
    const e = await prisma.expense.create({
      data: {
        expenseNumber,
        date: txn.date,
        category: account.name,
        accountId: account.id,
        supplierId: a.supplierId || null,
        description: a.description || memoBase,
        amount: abs,
        method: 'BANK_TRANSFER',
        reference: txn.reference,
        bankAccountId: txn.bankAccountId,
      },
    });
    await syncLedger([{ type: 'EXPENSE', id: e.id }]);
    await markMatched(txn.id, 'EXPENSE', e.id);
    return NextResponse.json({ ok: true, created: e.expenseNumber });
  }

  if (a.action === 'payment') {
    if (amt < 0) return bad('A customer payment is money in; this line is money out.');
    const inv = await prisma.invoice.findUnique({ where: { id: a.invoiceId } });
    if (!inv || inv.deletedAt || inv.status === 'VOID') return bad('That invoice is not open.');
    const p = await prisma.payment.create({
      data: {
        invoiceId: inv.id,
        amount: abs,
        method: 'BANK_TRANSFER',
        bankAccountId: txn.bankAccountId,
        reference: (txn.reference ?? txn.description).slice(0, 120),
        notes: 'Recorded from bank statement',
        paidAt: txn.date,
        recordedById: session!.user.id,
      },
    });
    if (inv.status === 'DRAFT') await prisma.invoice.update({ where: { id: inv.id }, data: { status: 'SENT' } });
    await recomputeInvoiceBalance(inv.id);
    await syncLedger([
      { type: 'INVOICE', id: inv.id },
      { type: 'PAYMENT', id: p.id },
    ]);
    await markMatched(txn.id, 'PAYMENT', p.id);
    return NextResponse.json({ ok: true, created: `payment on ${inv.invoiceNumber}` });
  }

  if (a.action === 'bill-payment') {
    if (amt > 0) return bad('A bill payment is money out; this line is money in.');
    const bill = await prisma.bill.findUnique({ where: { id: a.billId }, include: { lineItems: true } });
    if (!bill || bill.status === 'VOID') return bad('That bill is not open.');
    const sp = await prisma.supplierPayment.create({
      data: { billId: bill.id, amount: abs, method: 'BANK_TRANSFER', reference: txn.reference ?? null, bankAccountId: txn.bankAccountId, paidAt: txn.date },
    });
    const totalPaid = bill.lineItems.reduce((s, p) => s + Number(p.amount), 0) + abs;
    const balanceDue = Math.max(Number(bill.total) - totalPaid, 0);
    await prisma.bill.update({
      where: { id: bill.id },
      data: { amountPaid: totalPaid, balanceDue, status: balanceDue <= 0 ? 'PAID' : 'PARTIAL' },
    });
    await syncLedger([{ type: 'BILL_PAYMENT', id: sp.id }]);
    await markMatched(txn.id, 'BILL_PAYMENT', sp.id);
    return NextResponse.json({ ok: true, created: `payment of ${bill.billNumber}` });
  }

  if (a.action === 'transfer') {
    const other = await prisma.account.findUnique({ where: { id: a.accountId } });
    if (!other || other.id === txn.bankAccount.accountId) return bad('Pick the other account.');
    const t = await prisma.accountTransfer.create({
      data: {
        fromAccountId: amt > 0 ? other.id : txn.bankAccount.accountId,
        toAccountId: amt > 0 ? txn.bankAccount.accountId : other.id,
        amount: abs,
        date: txn.date,
        memo: a.memo || memoBase,
        createdById: session!.user.id,
      },
    });
    await syncLedger([{ type: 'TRANSFER', id: t.id }]);
    await markMatched(txn.id, 'TRANSFER', t.id);
    return NextResponse.json({ ok: true, created: 'transfer' });
  }

  if (a.action === 'journal') {
    const other = await prisma.account.findUnique({ where: { id: a.accountId } });
    if (!other || other.id === txn.bankAccount.accountId) return bad('Pick the other account.');
    const entryNumber = await nextDocumentNumber('journalEntryNextSeq', 'journalEntryPrefix');
    const je = await prisma.journalEntry.create({
      data: { entryNumber, date: txn.date, memo: `Bank: ${a.memo || memoBase}`.slice(0, 500), createdById: session!.user.id },
    });
    const bankAcc = txn.bankAccount.accountId;
    await prisma.journalLine.create({
      data: { journalEntryId: je.id, accountId: bankAcc, debit: amt > 0 ? abs : 0, credit: amt < 0 ? abs : 0, description: memoBase },
    });
    await prisma.journalLine.create({
      data: { journalEntryId: je.id, accountId: other.id, debit: amt < 0 ? abs : 0, credit: amt > 0 ? abs : 0, description: memoBase },
    });
    await refreshBankBalances();
    await markMatched(txn.id, 'JOURNAL', je.id);
    return NextResponse.json({ ok: true, created: entryNumber });
  }

  return bad('Unknown action.');
}
