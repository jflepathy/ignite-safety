import { getServerSession } from 'next-auth';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatMoney } from '@/lib/money';
import { isStaleAssignment } from '@/lib/work-order-status';
import ShareInvoiceButtons from '@/components/technician/share-invoice-buttons';

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  SENT: 'bg-blue-100 text-blue-700',
  PARTIAL: 'bg-amber-100 text-amber-700',
  PAID: 'bg-emerald-100 text-emerald-700',
  OVERDUE: 'bg-red-100 text-red-700',
  VOID: 'bg-slate-100 text-slate-400',
};

export default async function TechnicianInvoicePage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: { customer: true, lineItems: true, workOrder: true, payments: true },
  });
  if (!invoice) notFound();

  const isAdminPreview = session!.user.role === 'ADMIN';
  if (!isAdminPreview) {
    const wo = invoice.workOrder;
    if (!wo || (wo.assignedTechnicianId !== session!.user.id && !isStaleAssignment(wo))) notFound();
  }

  const settings = await prisma.appSettings.findUnique({ where: { id: 1 } });
  const currency = settings?.currencyCode ?? 'SCR';
  const sharePath = `/share/invoice/${invoice.shareToken}`;
  const pendingPayments = invoice.payments.filter(
    (p) => p.verificationStatus === 'PENDING_REVIEW' || p.verificationStatus === 'MISMATCH'
  );
  // Payments that actually count toward the balance -- confirmed by the AI
  // pass, by an admin, or recorded directly (verificationStatus NONE, the
  // normal office-recorded case). Shown so a technician sees a payment
  // land the moment it's confirmed, not just once the invoice is fully
  // paid (Session 19).
  const confirmedPayments = invoice.payments.filter(
    (p) => p.verificationStatus === 'CONFIRMED' || p.verificationStatus === 'NONE'
  );

  return (
    <div className="space-y-5">
      <div>
        <Link href={invoice.workOrder ? `/technician/${invoice.workOrder.id}` : '/technician'} className="text-sm text-slate-500 hover:underline">
          ← Back to job
        </Link>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Invoice</p>
            <p className="text-lg font-semibold text-ink-900">{invoice.invoiceNumber}</p>
          </div>
          <span className={`badge ${STATUS_STYLES[invoice.status] ?? 'bg-amber-100 text-amber-700'}`}>{invoice.status}</span>
        </div>
        <p className="mt-1 text-sm text-slate-500">{invoice.customer.displayName}</p>
        {invoice.status === 'DRAFT' && (
          <Link
            href={`/technician/invoice/${invoice.id}/edit`}
            className="mt-2 inline-block text-sm font-medium text-brand-600 hover:underline"
          >
            ✏️ Edit line items before sending
          </Link>
        )}

        <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-3">
          {invoice.lineItems.map((l) => (
            <div key={l.id} className="flex items-center justify-between text-sm">
              <span className="text-slate-600">
                {l.description} <span className="text-xs text-slate-400">× {l.quantity.toString()}</span>
              </span>
              <span className="font-medium text-ink-900">{formatMoney(l.lineTotal.toString(), currency)}</span>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-base font-semibold text-ink-900">
          <span>Total</span>
          <span>{formatMoney(invoice.total.toString(), currency)}</span>
        </div>
        {Number(invoice.balanceDue) > 0 && invoice.status !== 'DRAFT' && (
          <p className="mt-1 text-right text-sm text-amber-600">Balance due: {formatMoney(invoice.balanceDue.toString(), currency)}</p>
        )}
      </div>

      <ShareInvoiceButtons
        invoiceId={invoice.id}
        sharePath={sharePath}
        customerName={invoice.customer.displayName}
        customerPhone={invoice.customer.phone}
        customerEmail={invoice.customer.email}
        invoiceNumber={invoice.invoiceNumber}
        companyName={settings?.companyName ?? 'Ignite Safety'}
      />

      {confirmedPayments.length > 0 && (
        <div
          className={`rounded-xl border p-4 text-sm ${
            invoice.status === 'PAID' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-blue-200 bg-blue-50 text-blue-800'
          }`}
        >
          <p className="font-semibold">
            {invoice.status === 'PAID' ? '✓ Paid in full' : '✓ Payment received — partially paid'}
          </p>
          {confirmedPayments.map((p) => (
            <p key={p.id} className="mt-1">
              {p.method.replace('_', ' ')} — {formatMoney(p.amount.toString(), currency)} confirmed
            </p>
          ))}
          {invoice.status !== 'PAID' && (
            <p className="mt-1 font-medium">Balance still due: {formatMoney(invoice.balanceDue.toString(), currency)}</p>
          )}
        </div>
      )}

      {pendingPayments.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold">🕒 A payment was already submitted for this invoice</p>
          {pendingPayments.map((p) => (
            <p key={p.id} className="mt-1">
              {p.method.replace('_', ' ')} — {formatMoney(p.amount.toString(), currency)} —{' '}
              {p.verificationStatus === 'MISMATCH' ? 'flagged for office review' : 'awaiting office confirmation'}.
            </p>
          ))}
          <p className="mt-1 text-xs text-amber-700">
            Don&apos;t collect payment again — the office will confirm this shortly.
          </p>
        </div>
      )}

      {invoice.status !== 'PAID' && pendingPayments.length === 0 && (
        <Link href={`/technician/invoice/${invoice.id}/collect`} className="btn-primary block w-full py-3 text-center text-base">
          💵 Receive Payment
        </Link>
      )}
    </div>
  );
}
