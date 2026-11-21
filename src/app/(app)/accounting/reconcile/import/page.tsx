import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import StatementImporter from '@/components/accounting/statement-importer';

export const dynamic = 'force-dynamic';

export default async function ImportStatementPage({ searchParams }: { searchParams: { bank?: string } }) {
  const banks = await prisma.bankAccount.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } });
  return (
    <div className="space-y-6">
      <div>
        <Link href={`/accounting/reconcile${searchParams.bank ? `?bank=${searchParams.bank}` : ''}`} className="text-sm text-slate-500 hover:underline">
          ← Reconcile
        </Link>
        <h1 className="text-2xl font-semibold text-ink-900">Import bank statement</h1>
        <p className="text-sm text-slate-500">
          Upload the statement exported from internet banking (CSV, or the PDF statement). Check the lines, then import. Lines already
          imported are skipped automatically, so overlapping statements are fine.
        </p>
      </div>
      <StatementImporter banks={banks} defaultBankId={searchParams.bank} />
    </div>
  );
}
