import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { formatMoney } from '@/lib/money';
import { StatusBadge } from '@/components/status-badge';
import RecordPaymentForm from '@/components/billing/record-payment-form';
import PrintButton from '@/components/print-button';
import PrintOnLoad from '@/components/shared/print-on-load';
import ShareLinkButton from '@/components/shared/share-link-button';
import AttachmentsPanel from '@/components/shared/attachments-panel';
import InvoiceDocument, { type InvoiceDocumentData } from '@/components/billing/invoice-document';
import PrintCopies from '@/components/shared/print-copies';
import DownloadPdfButton from '@/components/shared/download-pdf-button';
import MarkAsSentButton from '@/components/billing/mark-as-sent-button';
import ConfirmPaymentButton from '@/components/billing/confirm-payment-button';
import DeleteRecordButton from '@/components/shared/delete-record-button';
import WhatsAppShareButton from '@/components/shared/whatsapp-share-button';
import EmailInvoiceButton from '@/components/billing/email-invoice-button';

export default async function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const [invoice, settings, bankAccounts, session] = await Promise.all([
    prisma.invoice.findUnique({
      where: { id: params.id },
      include: {
        customer: true,
        lineItems: { include: { taxRate: true, shopItem: true }, orderBy: { sortOrder: 'asc' } },
        payments: { orderBy: { paidAt: 'desc' }, include: { bankAccount: true } },
        workOrder: true,
      },
    }),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
    prisma.bankAccount.findMany({ orderBy: { name: 'asc' } }),
    getServerSession(authOptions),
  ]);
  if (!invoice) notFound();
  const isAdmin = session?.user.role === 'ADMIN';

  const attachments = await prisma.attachment.findMany({
    where: { entityType: 'Invoice', entityId: invoice.id },
    orderBy: { createdAt: 'desc' },
  });
  const paymentOptions = (invoice.customerPaymentOptions as Record<string, boolean> | null) ?? {};
  const paymentOptionLabels: Record<string, string> = { card: 'Card', bankTransfer: 'Bank Transfer', cash: 'Cash' };

  const currency = settings?.currencyCode ?? 'SCR';
  const allowedMethods = (settings?.allowedPaymentMethods as string[]) ?? ['CASH', 'CARD', 'BANK_TRANSFER', 'CHEQUE'];

  // Built once and handed to both InvoiceDocument (screen/print) and
  // DownloadPdfButton (the real text-based PDF) so the two can never
  // drift apart on the underlying data — see InvoiceDocumentData's own
  // comment in invoice-document.tsx.
  const documentData: InvoiceDocumentData = {
    settings: {
      companyName: settings?.companyName ?? 'Ignite Safety',
      companyAddress: settings?.companyAddress ?? null,
      companyPhone: settings?.companyPhone ?? null,
      companyEmail: settings?.companyEmail ?? null,
      taxRegistrationNumber: settings?.taxRegistrationNumber ?? null,
      logoUrl: settings?.logoUrl ?? null,
      paymentInstructions: settings?.paymentInstructions ?? null,
      bankName: settings?.bankName ?? null,
      bankAccountName: settings?.bankAccountName ?? null,
      bankAccountNumber: settings?.bankAccountNumber ?? null,
    },
    documentNumber: invoice.invoiceNumber,
    issueDate: invoice.issueDate.toLocaleDateString(),
    dueDate: invoice.dueDate ? invoice.dueDate.toLocaleDateString() : null,
    poNumber: invoice.poNumber,
    terms: invoice.terms,
    customer: {
      displayName: invoice.customer.displayName,
      address: invoice.customer.address,
      phone: invoice.customer.phone,
    },
    lineItems: invoice.lineItems.map((li) => ({
      id: li.id,
      sku: li.shopItem?.sku ?? null,
      description: li.description,
      quantity: li.quantity.toString(),
      unitPrice: li.unitPrice.toString(),
      discountPercent: li.discountPercent.toString(),
      taxName: li.taxRate?.name ?? null,
      lineTotal: li.lineTotal.toString(),
    })),
    currency,
    subtotal: invoice.subtotal.toString(),
    discountTotal: invoice.discountTotal.toString(),
    globalDiscountPercent: invoice.globalDiscountPercent.toString(),
    taxTotal: invoice.taxTotal.toString(),
    total: invoice.total.toString(),
    amountPaid: invoice.amountPaid.toString(),
    balanceDue: invoice.balanceDue.toString(),
    taxInclusive: invoice.taxInclusive,
    customerMessage: invoice.customerMessage,
  };

  return (
    <div className="space-y-6">
      <PrintOnLoad />
      <div className="flex items-start justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">{invoice.invoiceNumber}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <StatusBadge status={invoice.status} />
            <span className="text-sm text-slate-500">{invoice.customer.displayName}</span>
            {invoice.workOrder && (
              <span className="badge bg-slate-100 text-slate-600">Work Order {invoice.workOrder.woNumber}</span>
            )}
            {invoice.isRecurring && <span className="badge bg-blue-100 text-blue-700">Recurring</span>}
          </div>
          {Object.values(paymentOptions).some(Boolean) && (
            <p className="mt-1.5 text-xs text-slate-400">
              Accepted payment methods:{' '}
              {Object.entries(paymentOptions)
                .filter(([, v]) => v)
                .map(([k]) => paymentOptionLabels[k] ?? k)
                .join(', ')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <EmailInvoiceButton invoiceId={invoice.id} invoiceNumber={invoice.invoiceNumber} customerEmail={invoice.customer.email} />
          {invoice.shareToken && <ShareLinkButton path={`/share/invoice/${invoice.shareToken}`} />}
          {invoice.shareToken && (
            <WhatsAppShareButton
              phone={invoice.customer.phone}
              customerName={invoice.customer.displayName}
              documentLabel="invoice"
              documentNumber={invoice.invoiceNumber}
              companyName={documentData.settings.companyName}
              path={`/share/invoice/${invoice.shareToken}`}
            />
          )}
          <Link href={`/billing/invoices/${invoice.id}/edit`} className="btn-secondary">
            Edit
          </Link>
          {invoice.status === 'DRAFT' && (
            <MarkAsSentButton invoiceId={invoice.id} invoiceNumber={invoice.invoiceNumber} />
          )}
          <PrintButton />
          <DownloadPdfButton document={documentData} fileName={invoice.invoiceNumber} />
          {isAdmin && (
            <DeleteRecordButton
              apiUrl={`/api/invoices/${invoice.id}`}
              recordLabel={invoice.invoiceNumber}
              redirectTo="/billing?tab=documents"
            />
          )}
          <RecordPaymentForm
            invoiceId={invoice.id}
            balanceDue={Number(invoice.balanceDue)}
            currency={currency}
            allowedMethods={allowedMethods}
            bankAccounts={bankAccounts.map((a) => ({ id: a.id, name: a.name }))}
          />
        </div>
      </div>

      <div className="print-area">
       <PrintCopies copies={1} id="pdf-document">
        <InvoiceDocument {...documentData} />
       </PrintCopies>
      </div>

      <AttachmentsPanel
        entityType="Invoice"
        entityId={invoice.id}
        attachments={attachments.map((a) => ({
          id: a.id,
          fileName: a.fileName,
          fileUrl: a.fileUrl,
          fileSizeBytes: a.fileSizeBytes,
          createdAt: a.createdAt.toISOString(),
        }))}
      />

      {invoice.payments.length > 0 && (
        <div className="card p-6 print:hidden">
          <h2 className="mb-3 text-sm font-semibold text-ink-900">Payment History</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-500">
                <th className="py-2">Date</th>
                <th className="py-2">Method</th>
                <th className="py-2">Deposited To</th>
                <th className="py-2">Reference</th>
                <th className="py-2">Status</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.payments.map((p) => {
                const vs = (p as any).verificationStatus as 'NONE' | 'PENDING_REVIEW' | 'CONFIRMED' | 'MISMATCH';
                const proofPhotoUrl = (p as any).proofPhotoUrl as string | null;
                return (
                  <tr key={p.id} className="border-t border-slate-100">
                    <td className="py-2">{p.paidAt.toLocaleDateString()}</td>
                    <td className="py-2">{p.method.replace('_', ' ')}</td>
                    <td className="py-2 text-slate-500">{(p as any).bankAccount?.name ?? '—'}</td>
                    <td className="py-2 text-slate-500">{p.reference ?? '—'}</td>
                    <td className="py-2">
                      {vs === 'NONE' || vs === 'CONFIRMED' ? (
                        <span className="badge bg-emerald-100 text-emerald-700">Confirmed</span>
                      ) : vs === 'MISMATCH' ? (
                        <span className="badge bg-red-100 text-red-700">Mismatch — review photo</span>
                      ) : (
                        <span className="badge bg-amber-100 text-amber-700">Pending review</span>
                      )}
                      {(p as any).proofNotes && <p className="mt-1 text-xs text-slate-400">{(p as any).proofNotes}</p>}
                      <div className="mt-1 flex items-center gap-3 print:hidden">
                        {proofPhotoUrl && (
                          <a href={proofPhotoUrl} target="_blank" rel="noreferrer" className="text-xs font-medium text-brand-600 hover:underline">
                            View photo
                          </a>
                        )}
                        {(vs === 'PENDING_REVIEW' || vs === 'MISMATCH') && (
                          <ConfirmPaymentButton invoiceId={invoice.id} paymentId={p.id} />
                        )}
                      </div>
                    </td>
                    <td className="py-2 text-right font-medium">{formatMoney(p.amount.toString(), currency)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
