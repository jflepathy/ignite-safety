import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { StatusBadge } from '@/components/status-badge';
import PrintButton from '@/components/print-button';
import PrintOnLoad from '@/components/shared/print-on-load';
import InvoiceDocument from '@/components/billing/invoice-document';
import DownloadPdfButton from '@/components/shared/download-pdf-button';

export default async function EstimateDetailPage({ params }: { params: { id: string } }) {
  const [estimate, settings] = await Promise.all([
    prisma.estimate.findUnique({
      where: { id: params.id },
      include: {
        customer: true,
        lineItems: { include: { taxRate: true, shopItem: true }, orderBy: { sortOrder: 'asc' } },
      },
    }),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
  ]);
  if (!estimate) notFound();
  const currency = settings?.currencyCode ?? 'SCR';

  return (
    <div className="space-y-6">
      <PrintOnLoad />
      <div className="flex items-start justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">{estimate.estimateNumber}</h1>
          <div className="mt-1 flex items-center gap-2">
            <StatusBadge status={estimate.status} />
            <span className="text-sm text-slate-500">{estimate.customer.displayName}</span>
            {estimate.expiryDate && (
              <span className="text-xs text-slate-400">Valid until {estimate.expiryDate.toLocaleDateString()}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/billing?tab=estimates" className="btn-secondary">
            ← Back
          </Link>
          <PrintButton />
          <DownloadPdfButton targetId="pdf-document" fileName={estimate.estimateNumber} />
        </div>
      </div>

      <div className="print-area" id="pdf-document">
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
          documentLabel="Estimate"
          documentNumber={estimate.estimateNumber}
          issueDate={estimate.issueDate.toLocaleDateString()}
          customer={{
            displayName: estimate.customer.displayName,
            address: estimate.customer.address,
            phone: estimate.customer.phone,
          }}
          lineItems={estimate.lineItems.map((li) => ({
            id: li.id,
            sku: li.shopItem?.sku ?? null,
            description: li.description,
            quantity: li.quantity.toString(),
            unitPrice: li.unitPrice.toString(),
            discountPercent: li.discountPercent.toString(),
            taxName: li.taxRate?.name ?? null,
            lineTotal: li.lineTotal.toString(),
          }))}
          currency={currency}
          subtotal={estimate.subtotal.toString()}
          discountTotal={estimate.discountTotal.toString()}
          globalDiscountPercent={estimate.globalDiscountPercent.toString()}
          taxTotal={estimate.taxTotal.toString()}
          total={estimate.total.toString()}
          balanceDue={estimate.total.toString()}
          taxInclusive={estimate.taxInclusive}
          customerMessage={estimate.customerMessage}
          totalLabel="Total"
          showTaxNote={false}
          headerGradient
        />
      </div>
    </div>
  );
}
