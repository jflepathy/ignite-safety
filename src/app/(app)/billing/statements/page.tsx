import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { buildStatement, ensureStatementToken } from '@/lib/statement';
import StatementDocument from '@/components/billing/statement-document';
import PrintButton from '@/components/print-button';
import ShareLinkButton from '@/components/shared/share-link-button';
import WhatsAppShareButton from '@/components/shared/whatsapp-share-button';
import { DownloadStatementButton, EmailStatementButton } from '@/components/billing/statement-actions';

export default async function StatementsPage({ searchParams }: { searchParams: { customerId?: string; from?: string; to?: string } }) {
  const customers = await prisma.customer.findMany({
    where: { deletedAt: null },
    select: { id: true, displayName: true, statementToken: true },
    orderBy: { displayName: 'asc' },
  });
  const sel = customers.find((c) => c.id === searchParams.customerId);
  const from = searchParams.from || '';
  const to = searchParams.to || '';
  const data = sel
    ? await buildStatement(sel.id, { from: from ? new Date(from) : null, to: to ? new Date(to) : null })
    : null;
  const token = sel && data ? await ensureStatementToken(sel.id, sel.statementToken) : null;

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <h1 className="text-2xl font-semibold text-ink-900">Customer Statements</h1>
        <p className="text-sm text-slate-500">Account statement with running balance and ageing. Print it, save as PDF, email it or share a link.</p>
      </div>

      <form className="card flex flex-wrap items-end gap-3 p-4 print:hidden" method="get">
        <label className="text-sm">
          Customer
          <select name="customerId" defaultValue={searchParams.customerId ?? ''} className="input mt-1 min-w-[16rem]">
            <option value="">Select a customer…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.displayName}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          From <span className="text-slate-400">(blank = all)</span>
          <input type="date" name="from" defaultValue={from} className="input mt-1" />
        </label>
        <label className="text-sm">
          To <span className="text-slate-400">(blank = today)</span>
          <input type="date" name="to" defaultValue={to} className="input mt-1" />
        </label>
        <button className="btn-primary" type="submit">Show statement</button>
      </form>

      {data && token ? (
        <>
          <div className="flex flex-wrap items-center justify-end gap-3 print:hidden">
            <EmailStatementButton customerId={data.customer.id} from={from} to={to} email={data.customer.email} />
            <ShareLinkButton path={`/share/statement/${token}`} />
            <WhatsAppShareButton
              phone={data.customer.phone}
              customerName={data.customer.displayName}
              documentLabel="statement"
              documentNumber={data.statementDate}
              companyName={data.settings.companyName}
              path={`/share/statement/${token}`}
            />
            <PrintButton />
            <DownloadStatementButton data={data} fileName={`Statement_${data.customer.displayName.replace(/[^A-Za-z0-9]+/g, '_')}`} />
          </div>
          <div className="print-area">
            <StatementDocument data={data} />
          </div>
        </>
      ) : (
        <p className="text-sm text-slate-400 print:hidden">
          Pick a customer to see their statement. You can also open one from the{' '}
          <Link href="/customers" className="underline">Customers</Link> list.
        </p>
      )}
    </div>
  );
}
