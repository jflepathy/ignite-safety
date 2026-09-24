import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { canEditModule } from '@/lib/edit-permissions-constants';
import ReclassifyClient from '@/components/accounting/reclassify-client';

// Session 22, round 10 — Transaction Reclassify (Tier 3). Gated the same
// way as Chart of Accounts editing (canEditModule('chartOfAccounts', ...))
// since this bulk-moves the account coding on Expense and BillLineItem
// rows. View-only for anyone without that edit grant, matching how the
// rest of Accounting behaves for non-admin Sales users.
export default async function ReclassifyPage() {
  const [accounts, session, settings] = await Promise.all([
    prisma.account.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } }),
    getServerSession(authOptions),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
  ]);
  const isAdmin = session?.user.role === 'ADMIN';
  const canEdit = canEditModule('chartOfAccounts', isAdmin, session?.user.editModules);
  const currency = settings?.currencyCode ?? 'SCR';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">Reclassify Transactions</h1>
        <p className="text-sm text-slate-500">
          Move expenses and bill line items that were coded to the wrong account, in bulk — pick a "from" account,
          select the transactions, and move them to the right one.
        </p>
      </div>
      <ReclassifyClient
        accounts={accounts.map((a) => ({ id: a.id, code: a.code, name: a.name, type: a.type }))}
        canEdit={canEdit}
        currency={currency}
      />
    </div>
  );
}
