import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import PrintButton from '@/components/print-button';
import PrintOnLoad from '@/components/shared/print-on-load';
import InvoiceDocument from '@/components/billing/invoice-document';
import PrintCopies from '@/components/shared/print-copies';
import DownloadPdfButton from '@/components/shared/download-pdf-button';

export default async function SalesReceiptDetailPage({ params }: { params: { id: string } }) {
  const [receipt, settings] = await Promise.all([
    prisma.salesReceipt.findUnique({
      where: { id: params.id },
      include: { customer: true, lineItems: { include: { taxRate: true, shopItem: true } } },
    }),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
  ]);
  if (!receipt) notFound();
  const currency = settings?.currencyCode ?? 'SCR';

  return (
    <div className="space-y-6">
      <PrintOnLoad />
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">{receipt.receiptNumber}</h1>
          <div className="mt-1 flex items-center gap-2">
            <p className="text-sm text-slate-500">{receipt.customer.displayName}</p>
            <span className="badge bg-emerald-100 text-emerald-700">
              Paid via {receipt.paymentMethod.replace('_', ' ')}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/billing/sales-receipts" className="btn-secondary">
            ← Back
          </Link>
          <Link href={`/billing/sales-receipts/${receipt.id}/edit`} className="btn-secondary">
            Edit
          </Link>
          <PrintButton />
          <DownloadPdfButton targetId="pdf-document" fileName={receipt.receiptNumber} />
        </div>
      </div>

      <div className="print-area">
       <PrintCopies copies={1} id="pdf-document">
        <InvoiceDocument
          settings={{
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
          }}
          documentLabel="Sales Receipt"
          documentNumber={receipt.receiptNumber}
          issueDate={receipt.saleDate.toLocaleDateString()}
          customer={{
            displayName: receipt.customer.displayName,
            address: receipt.customer.address,
            phone: receipt.customer.phone,
          }}
          lineItems={receipt.lineItems.map((li) => ({
            id: li.id,
            sku: li.shopItem?.sku ?? null,
            description: li.description,
            quantity: li.quantity.toString(),
            unitPrice: li.unitPrice.toString(),
            discountPercent: '0',
            taxName: li.taxRate?.name ?? null,
            lineTotal: li.lineTotal.toString(),
          }))}
          currency={currency}
          subtotal={receipt.subtotal.toString()}
          discountTotal="0"
          globalDiscountPercent="0"
          taxTotal={receipt.taxTotal.toString()}
          total={receipt.total.toString()}
          amountPaid={receipt.total.toString()}
          balanceDue="0"
        />
       </PrintCopies>
      </div>
    </div>
  );
}
