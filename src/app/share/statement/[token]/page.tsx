import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { buildStatement } from '@/lib/statement';
import StatementDocument from '@/components/billing/statement-document';
import PrintButton from '@/components/print-button';

// Public, unauthenticated, always-current statement for a customer's link.
export const dynamic = 'force-dynamic';

export default async function SharedStatementPage({ params }: { params: { token: string } }) {
  const customer = await prisma.customer.findUnique({ where: { statementToken: params.token }, select: { id: true } });
  if (!customer) notFound();
  const data = await buildStatement(customer.id, {});
  if (!data) notFound();
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-xl font-semibold text-ink-900">Statement - {data.customer.displayName}</h1>
        <PrintButton />
      </div>
      <div className="print-area">
        <StatementDocument data={data} />
      </div>
    </div>
  );
}
