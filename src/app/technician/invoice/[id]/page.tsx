import { getServerSession } from 'next-auth';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatMoney } from '@/lib/money';
import { isStaleAssignment } from '@/lib/work-order-status';
import ShareInvoiceButtons from '@/components/technician/share-invoice-buttons';

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
          <span className={`badge ${invoice.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{invoice.status}</span>
        </div>
        <p className="mt-1 text-sm text-slate-500">{invoice.customer.displayName}</p>

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
        sharePath={sharePath}
        customerName={invoice.customer.displayName}
        customerPhone={invoice.customer.phone}
        customerEmail={invoice.customer.email}
        invoiceNumber={invoice.invoiceNumber}
        companyName={settings?.companyName ?? 'Ignite Safety'}
      />

      {invoice.status !== 'PAID' && (
        <Link href={`/technician/invoice/${invoice.id}/collect`} className="btn-primary block w-full py-3 text-center text-base">
          💵 Receive Payment
        </Link>
      )}
    </div>
  );
}
