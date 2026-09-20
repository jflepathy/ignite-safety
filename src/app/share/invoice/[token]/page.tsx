import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { StatusBadge } from '@/components/status-badge';
import PrintButton from '@/components/print-button';
import InvoiceDocument from '@/components/billing/invoice-document';

// Public, unauthenticated view for a shared invoice link. Deliberately
// excludes internal notes and lives outside the (app) route group so no
// login is required — anyone with the link (and only the link) can view it.
export default async function SharedInvoicePage({ params }: { params: { token: string } }) {
  const invoice = await prisma.invoice.findUnique({
    where: { shareToken: params.token },
    include: {
      customer: true,
      lineItems: { include: { taxRate: true, shopItem: true }, orderBy: { sortOrder: 'asc' } },
      payments: { orderBy: { paidAt: 'desc' } },
    },
  });
  if (!invoice || invoice.deletedAt) notFound();

  const settings = await prisma.appSettings.findUnique({ where: { id: 1 } });
  const currency = settings?.currencyCode ?? 'SCR';

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Invoice {invoice.invoiceNumber}</h1>
          <StatusBadge status={invoice.status} />
        </div>
        <PrintButton />
      </div>

      <div className="print-area">
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
          documentNumber={invoice.invoiceNumber}
          issueDate={invoice.issueDate.toLocaleDateString()}
          dueDate={invoice.dueDate ? invoice.dueDate.toLocaleDateString() : null}
          terms={invoice.terms}
          customer={{
            displayName: invoice.customer.displayName,
            address: invoice.customer.address,
            phone: invoice.customer.phone,
          }}
          lineItems={invoice.lineItems.map((li) => ({
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
          subtotal={invoice.subtotal.toString()}
          discountTotal={invoice.discountTotal.toString()}
          globalDiscountPercent={invoice.globalDiscountPercent.toString()}
          taxTotal={invoice.taxTotal.toString()}
          total={invoice.total.toString()}
          amountPaid={invoice.amountPaid.toString()}
          balanceDue={invoice.balanceDue.toString()}
          taxInclusive={invoice.taxInclusive}
          customerMessage={invoice.customerMessage}
        />
      </div>
    </div>
  );
}
