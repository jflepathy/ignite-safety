import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { formatMoney } from '@/lib/money';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import BillingTabsClient from '@/components/billing/billing-tabs-client';
import ConfirmPaymentButton from '@/components/billing/confirm-payment-button';

export default async function BillingPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const session = await getServerSession(authOptions);
  const currency = 'SCR';
  const tab = searchParams.tab ?? 'all';

  const [settings, invoices, salesReceipts, estimates, creditNotes] = await Promise.all([
    prisma.appSettings.findUnique({ where: { id: 1 } }),
    prisma.invoice.findMany({
      where: { deletedAt: null },
      include: { customer: true, payments: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    // Invoices and Sales Receipts draw from the same shared numbering
    // sequence (invoiceNextSeq/invoicePrefix — see the Sales Receipt POST
    // route) and are shown together as one "Invoice & Sales Receipts" tab
    // below, rather than two separate lists.
    prisma.salesReceipt.findMany({
      include: { customer: true },
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

  // Cheque/Transfer payments a technician collected in the field (Session
  // 16 billing bridge) that are still PENDING_REVIEW or MISMATCH — with no
  // AI key configured, this is the *only* place an admin can act on them,
  // so it's surfaced right at the top of Billing rather than requiring
  // anyone to already know which invoice to open.
  const paymentsToReview = await prisma.payment.findMany({
    where: { verificationStatus: { in: ['PENDING_REVIEW', 'MISMATCH'] } },
    include: { invoice: { include: { customer: true } } },
    orderBy: { paidAt: 'desc' },
    take: 30,
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

      {paymentsToReview.length > 0 && (
        <div className="card border-amber-200 bg-amber-50 p-4">
          <h2 className="mb-3 text-sm font-semibold text-amber-900">
            Payments awaiting review ({paymentsToReview.length})
          </h2>
          <p className="mb-3 text-xs text-amber-700">
            Cheque / bank transfer payments a technician collected in the field — confirm these match the proof
            photo to mark the invoice paid and move the money into the bank account.
          </p>
          <div className="divide-y divide-amber-100">
            {paymentsToReview.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <div>
                  <Link href={`/billing/invoices/${p.invoiceId}`} className="font-medium text-brand-700 hover:underline">
                    {p.invoice.invoiceNumber}
                  </Link>
                  <span className="ml-2 text-slate-500">{p.invoice.customer.displayName}</span>
                  <span
                    className={`ml-2 badge ${p.verificationStatus === 'MISMATCH' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}
                  >
                    {p.method.replace('_', ' ')} · {p.verificationStatus === 'MISMATCH' ? 'Mismatch' : 'Pending review'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium text-ink-900">{formatMoney(p.amount.toString(), curr)}</span>
                  <ConfirmPaymentButton invoiceId={p.invoiceId} paymentId={p.id} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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

      {/* One unified, date-sorted row set backs every tab below — "All" is
          the whole thing, "Estimates" / "Invoice & Sales Receipts" /
          "Credit Notes" are just client-side filters of it by docType, so
          there is exactly one table implementation and one sort order to
          keep consistent instead of four. Invoices and Sales Receipts are
          combined into the same docType group since they share one
          numbering sequence (see the query above). */}
      <BillingTabsClient
        currency={curr}
        initialTab={tab}
        docs={[
          ...invoices.map((inv) => ({
            id: inv.id,
            docType: 'invoice' as const,
            number: inv.invoiceNumber,
            href: `/billing/invoices/${inv.id}`,
            customerName: inv.customer.displayName,
            date: inv.issueDate.toLocaleDateString(),
            dateSort: inv.issueDate.toISOString(),
            total: inv.total.toString(),
            balanceDue: inv.balanceDue.toString(),
            status: inv.status,
          })),
          ...salesReceipts.map((r) => ({
            id: r.id,
            docType: 'salesReceipt' as const,
            number: r.receiptNumber,
            href: `/billing/sales-receipts/${r.id}`,
            customerName: r.customer.displayName,
            date: r.saleDate.toLocaleDateString(),
            dateSort: r.saleDate.toISOString(),
            total: r.total.toString(),
            balanceDue: null,
            status: 'PAID',
          })),
          ...estimates.map((es) => ({
            id: es.id,
            docType: 'estimate' as const,
            number: es.estimateNumber,
            href: `/billing/estimates/${es.id}`,
            customerName: es.customer.displayName,
            date: es.issueDate.toLocaleDateString(),
            dateSort: es.issueDate.toISOString(),
            total: es.total.toString(),
            balanceDue: null,
            status: es.status,
          })),
          ...creditNotes.map((cn) => ({
            id: cn.id,
            docType: 'creditNote' as const,
            number: cn.creditNoteNumber,
            // No credit note detail page exists yet (unlike Invoice/
            // Estimate/Sales Receipt) — kept as plain, non-clickable text,
            // matching how the old Credit Notes tab always rendered it.
            href: null,
            customerName: cn.customer.displayName,
            date: cn.createdAt.toLocaleDateString(),
            dateSort: cn.createdAt.toISOString(),
            total: cn.total.toString(),
            balanceDue: null,
            status: cn.status,
          })),
        ].sort((a, b) => (a.dateSort < b.dateSort ? 1 : -1))}
      />
    </div>
  );
}
