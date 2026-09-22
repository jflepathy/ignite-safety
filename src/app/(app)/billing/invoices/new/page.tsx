import { prisma } from '@/lib/prisma';
import InvoiceForm from '@/components/billing/invoice-form';

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: { workOrderId?: string };
}) {
  const [customers, shopItems, taxRates, settings, workOrder] = await Promise.all([
    prisma.customer.findMany({ where: { deletedAt: null }, orderBy: { displayName: 'asc' } }),
    prisma.shopItem.findMany({ where: { active: true }, orderBy: { sku: 'asc' } }),
    prisma.taxRate.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
    searchParams.workOrderId
      ? prisma.workOrder.findUnique({ where: { id: searchParams.workOrderId } })
      : null,
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">New Invoice</h1>
        <p className="text-sm text-slate-500">
          {workOrder
            ? `Billing for completed work order ${workOrder.woNumber}`
            : 'Manually created — nothing is sent until you choose to.'}
        </p>
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
        defaultCustomerId={workOrder?.customerId}
        defaultTerms={settings?.invoiceTermsDefault ?? undefined}
        workOrderId={workOrder?.id}
      />
    </div>
  );
}
