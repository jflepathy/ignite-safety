import { prisma } from '@/lib/prisma';
import JournalEntryForm from '@/components/accounting/journal-entry-form';

export default async function NewJournalEntryPage() {
  const accounts = await prisma.account.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">New Journal Entry</h1>
        <p className="text-sm text-slate-500">Manual posting — total debits must equal total credits.</p>
      </div>
      <JournalEntryForm accounts={accounts.map((a) => ({ id: a.id, name: a.name, code: a.code }))} />
    </div>
  );
}
