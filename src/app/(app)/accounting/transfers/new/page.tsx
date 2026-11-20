import { prisma } from '@/lib/prisma';
import TransferForm from '@/components/accounting/transfer-form';

export default async function NewTransferPage() {
  const accounts = await prisma.account.findMany({ where: { isActive: true, type: { in: ['ASSET', 'LIABILITY', 'EQUITY'] } }, orderBy: [{ code: 'asc' }, { name: 'asc' }] });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">Transfer</h1>
        <p className="text-sm text-slate-500">Move money between two accounts.</p>
      </div>
      <TransferForm accounts={accounts.map((a) => ({ id: a.id, name: a.code ? `${a.code} · ${a.name}` : a.name }))} />
    </div>
  );
}
