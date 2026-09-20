import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { formatMoney } from '@/lib/money';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import BillingTabsClient from '@/components/billing/billing-tabs-client';

export default async function BillingPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const session = await getServerSession(authOptions);
  const currency = 'SCR';
  const tab = searchParams.tab ?? 'invoices';

  const [settings, invoices, estimates, creditNotes] = await Promise.all([
    prisma.appSettings.findUnique({ where: { id: 1 } }),
    prisma.invoice.findMany({
      where: { deletedAt: null },
      include: { customer: true, payments: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.estimate.findMany({
      where: { deletedAt: null },
      include: { customer: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.creditNote.findMany({
      include: { customer: true, invoice: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  ]);
  const curr = settings?.currencyCode ?? currency;

  const openWorkOrders = await prisma.workOrder.findMany({
    where: { status: 'COMPLETED', invoiceId: null, deletedAt: null },
    include: { customer: true },
    orderBy: { completedAt: 'desc' },
    take: 20,
  });

  const outstanding = invoices.reduce((s, i) => s + Number(i.balanceDue), 0);
  const overdueCount = invoices.filter((i) => i.status === 'OVERDUE').length;
  const paidThisMonth = invoices
    .flatMap((i) => i.payments)
    .filter((p) => new Date(p.paidAt).getMonth() === new Date().getMonth())
    .reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Billing</h1>
          <p className="text-sm text-slate-500">
            Manual invoicing, estimates & credit notes — nothing is ever sent automatically.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/billing/estimates/new" className="btn-secondary">
            + New Estimate
          </Link>
          <Link href="/billing/invoices/new" className="btn-primary">
            + New Invoice
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs font-medium uppercase text-slate-500">Outstanding A/R</p>
          <p className="mt-1 text-2xl font-semibold text-ink-900">{formatMoney(outstanding, curr)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium uppercase text-slate-500">Overdue Invoices</p>
          <p className="mt-1 text-2xl font-semibold text-red-600">{overdueCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium uppercase text-slate-500">Collected This Month</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-600">{formatMoney(paidThisMonth, curr)}</p>
        </div>
      </div>

      {openWorkOrders.length > 0 && (
        <div className="card p-4">
          <h2 className="mb-3 text-sm font-semibold text-ink-900">
            Completed work orders ready to bill ({openWorkOrders.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            {openWorkOrders.map((wo) => (
              <Link
                key={wo.id}
                href={`/billing/invoices/new?workOrderId=${wo.id}`}
                className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-700 hover:bg-brand-100"
              >
                {wo.woNumber} — {wo.customer.displayName} → Draft invoice
              </Link>
            ))}
          </div>
        </div>
      )}

      <BillingTabsClient
        currency={curr}
        initialTab={tab}
        invoices={invoices.map((inv) => ({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          customerName: inv.customer.displayName,
          issueDate: inv.issueDate.toLocaleDateString(),
          dueDate: inv.dueDate ? inv.dueDate.toLocaleDateString() : null,
          total: inv.total.toString(),
          balanceDue: inv.balanceDue.toString(),
          status: inv.status,
        }))}
        estimates={estimates.map((es) => ({
          id: es.id,
          estimateNumber: es.estimateNumber,
          customerName: es.customer.displayName,
          issueDate: es.issueDate.toLocaleDateString(),
          total: es.total.toString(),
          status: es.status,
        }))}
        creditNotes={creditNotes.map((cn) => ({
          id: cn.id,
          creditNoteNumber: cn.creditNoteNumber,
          customerName: cn.customer.displayName,
          relatedInvoiceNumber: cn.invoice?.invoiceNumber ?? null,
          total: cn.total.toString(),
          status: cn.status,
        }))}
      />
    </div>
  );
}
