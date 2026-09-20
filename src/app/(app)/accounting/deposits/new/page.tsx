import { prisma } from '@/lib/prisma';
import DepositForm from '@/components/accounting/deposit-form';

export default async function NewDepositPage() {
  const bankAccounts = await prisma.bankAccount.findMany({ orderBy: { name: 'asc' } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">Bank Deposit</h1>
        <p className="text-sm text-slate-500">Record money deposited into an account.</p>
      </div>
      <DepositForm bankAccounts={bankAccounts.map((a) => ({ id: a.id, name: a.name }))} />
    </div>
  );
}
