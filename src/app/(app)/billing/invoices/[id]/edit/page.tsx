import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import InvoiceForm, { InvoiceFormInitial } from '@/components/billing/invoice-form';

export default async function EditInvoicePage({ params }: { params: { id: string } }) {
  const [invoice, customers, shopItems, taxRates, settings] = await Promise.all([
    prisma.invoice.findUnique({
      where: { id: params.id },
      include: { lineItems: { orderBy: { sortOrder: 'asc' } } },
    }),
    prisma.customer.findMany({ where: { deletedAt: null }, orderBy: { displayName: 'asc' } }),
    prisma.shopItem.findMany({ where: { active: true }, orderBy: { sku: 'asc' } }),
    prisma.taxRate.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
  ]);
  if (!invoice) notFound();

  const paymentOptions = (invoice.customerPaymentOptions as Record<string, boolean> | null) ?? {};

  const initial: InvoiceFormInitial = {
    customerId: invoice.customerId,
    dueDate: invoice.dueDate ? invoice.dueDate.toISOString().slice(0, 10) : '',
    poNumber: invoice.poNumber ?? '',
    globalDiscountPercent: Number(invoice.globalDiscountPercent),
    terms: invoice.terms ?? '',
    notes: invoice.notes ?? '',
    customerMessage: invoice.customerMessage ?? '',
    taxInclusive: invoice.taxInclusive,
    paymentOptions: {
      card: paymentOptions.card ?? true,
      bankTransfer: paymentOptions.bankTransfer ?? true,
      cash: paymentOptions.cash ?? true,
    },
    lines: invoice.lineItems.map((li) => ({
      key: li.id,
      shopItemId: li.shopItemId,
      description: li.description,
      quantity: Number(li.quantity),
      unitPrice: Number(li.unitPrice),
      discountPercent: Number(li.discountPercent),
      taxRateId: li.taxRateId,
    })),
    issueDateForDueCalc: invoice.issueDate.toISOString().slice(0, 10),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">Edit Invoice {invoice.invoiceNumber}</h1>
        <p className="text-sm text-slate-500">Changes are saved to this invoice in place — its number stays the same.</p>
      </div>
      <InvoiceForm
        customers={customers.map((c) => ({ id: c.id, displayName: c.displayName }))}
        shopItems={shopItems.map((s) => ({
          id: s.id,
          sku: s.sku,
          name: s.name,
          unitPrice: s.unitPrice.toString(),
          taxable: s.taxable,
        }))}
        taxRates={taxRates.map((t) => ({
          id: t.id,
          name: t.name,
          ratePercent: t.ratePercent.toString(),
          isDefault: t.isDefault,
        }))}
        currency={settings?.currencyCode ?? 'SCR'}
        mode="edit"
        invoiceId={invoice.id}
        initial={initial}
      />
    </div>
  );
}
