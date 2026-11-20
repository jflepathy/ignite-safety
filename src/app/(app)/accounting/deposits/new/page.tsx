import { prisma } from '@/lib/prisma';
import DepositForm from '@/components/accounting/deposit-form';
import { undepositedItems } from '@/lib/deposits';
import { formatDate } from '@/lib/format-date';

export const dynamic = 'force-dynamic';

export default async function NewDepositPage() {
  const [bankAccounts, items, settings] = await Promise.all([
    prisma.bankAccount.findMany({ orderBy: { name: 'asc' } }),
    undepositedItems(),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">Bank Deposit</h1>
        <p className="text-sm text-slate-500">
          Tick the payments and sales receipts you are paying in. They move from Undeposited Funds into the account you choose.
        </p>
      </div>
      <DepositForm
        currency={settings?.currencyCode ?? 'SCR'}
        bankAccounts={bankAccounts.map((a) => ({ id: a.id, name: a.name }))}
        items={items.map((i) => ({ ...i, date: formatDate(i.date) }))}
      />
    </div>
  );
}
