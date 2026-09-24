import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireEdit } from '@/lib/api-auth';
import { z } from 'zod';

/**
 * Links a Chart-of-Accounts row to a new BankAccount row, so it shows up
 * everywhere a "Deposit To" / bank-account picker is populated from
 * `prisma.bankAccount.findMany()` (Record Payment, the Deposit form, bank
 * Reconcile, Team > Incentive Rates' payment references, etc.).
 *
 * Why this route exists: creating a new Asset account via Chart of
 * Accounts (`POST /api/accounts`) only ever creates the `Account` row —
 * it was never wired to also create a `BankAccount`, which is a separate
 * table (`Account.bankAccount`, an optional 1:1). A user adding a new
 * asset account expecting to immediately deposit into it hit exactly
 * that gap: the account existed and showed correctly in Chart of
 * Accounts, but every Deposit To dropdown in the app stayed empty of it,
 * because those dropdowns never look at `Account` at all. This route
 * lets an admin turn an existing Asset account into a usable bank
 * account after the fact, from the Chart of Accounts page.
 */
const CreateSchema = z.object({
  accountType: z.enum(['CHECKING', 'SAVINGS', 'CREDIT_CARD']).default('CHECKING'),
  accountNumberMasked: z.string().optional(),
  openingBalance: z.coerce.number().default(0),
  currencyCode: z.string().min(1).default('SCR'),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireEdit('chartOfAccounts', 'ADMIN', 'SALES');
  if (error) return error;

  const account = await prisma.account.findUnique({
    where: { id: params.id },
    include: { bankAccount: true },
  });
  if (!account) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
  if (account.type !== 'ASSET') {
    return NextResponse.json({ error: 'Only Asset accounts can be used as a deposit/bank account.' }, { status: 400 });
  }
  if (account.bankAccount) {
    return NextResponse.json({ error: 'This account is already enabled for deposits.' }, { status: 409 });
  }

  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const bankAccount = await prisma.bankAccount.create({
    data: {
      accountId: account.id,
      name: account.name,
      accountType: parsed.data.accountType,
      accountNumberMasked: parsed.data.accountNumberMasked || null,
      openingBalance: parsed.data.openingBalance,
      currentBalance: parsed.data.openingBalance,
      currencyCode: parsed.data.currencyCode,
    },
  });
  return NextResponse.json(bankAccount, { status: 201 });
}

/**
 * Reverses the POST above — removes the Asset account from every "Deposit
 * To" picker by deleting its BankAccount row. Deliberately refuses when
 * the account has any real history against it (a recorded Payment,
 * Deposit, or BankTransaction) rather than silently deleting and orphaning
 * that history, or worse, cascading it away — this table has no separate
 * "enabled" flag to just flip off, and payments/deposits keep a hard
 * `bankAccountId` reference, so an unused link is the only kind that's
 * ever actually safe to remove outright.
 */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireEdit('chartOfAccounts', 'ADMIN', 'SALES');
  if (error) return error;

  const account = await prisma.account.findUnique({
    where: { id: params.id },
    include: { bankAccount: true },
  });
  if (!account) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
  if (!account.bankAccount) {
    return NextResponse.json({ error: 'This account is not enabled for deposits.' }, { status: 409 });
  }

  const bankAccountId = account.bankAccount.id;
  const [paymentCount, depositCount, transactionCount] = await Promise.all([
    prisma.payment.count({ where: { bankAccountId } }),
    prisma.deposit.count({ where: { bankAccountId } }),
    prisma.bankTransaction.count({ where: { bankAccountId } }),
  ]);
  if (paymentCount + depositCount + transactionCount > 0) {
    const parts: string[] = [];
    if (paymentCount) parts.push(`${paymentCount} payment${paymentCount === 1 ? '' : 's'}`);
    if (depositCount) parts.push(`${depositCount} deposit${depositCount === 1 ? '' : 's'}`);
    if (transactionCount) parts.push(`${transactionCount} bank transaction${transactionCount === 1 ? '' : 's'}`);
    return NextResponse.json(
      {
        error: `Can't remove — this account has ${parts.join(', ')} recorded against it. Removing it would orphan that history. Reconcile or reassign that activity first if you really need to disable it.`,
      },
      { status: 409 }
    );
  }

  await prisma.bankAccount.delete({ where: { id: bankAccountId } });
  return NextResponse.json({ ok: true });
}
