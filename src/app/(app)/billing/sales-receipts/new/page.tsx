import { prisma } from '@/lib/prisma';
import SalesReceiptFormClient from '@/components/billing/sales-receipt-form-client';

export default async function NewSalesReceiptPage({ searchParams }: { searchParams: { duplicateFrom?: string } }) {
  const [customers, shopItems, taxRates, settings, source] = await Promise.all([
    prisma.customer.findMany({ where: { deletedAt: null }, orderBy: { displayName: 'asc' } }),
    prisma.shopItem.findMany({ where: { active: true }, orderBy: { sku: 'asc' } }),
    prisma.taxRate.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
    searchParams.duplicateFrom
      ? prisma.salesReceipt.findUnique({ where: { id: searchParams.duplicateFrom }, include: { lineItems: true } })
      : null,
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">New Sales Receipt</h1>
        <p className="text-sm text-slate-500">
          {source ? `Copy of sales receipt ${source.receiptNumber} — review, then save as a new receipt.` : "Use this for a sale that's paid in full right away."}
        </p>
      </div>
      <SalesReceiptFormClient
        customers={customers.map((c) => ({ id: c.id, name: c.displayName }))}
        shopItems={shopItems.map((s) => ({ id: s.id, sku: s.sku, name: s.name, unitPrice: s.unitPrice.toString() }))}
        taxRates={taxRates.map((t) => ({ id: t.id, name: t.name, ratePercent: t.ratePercent.toString() }))}
        currency={settings?.currencyCode ?? 'SCR'}
        initial={
          source
            ? {
                partyId: source.customerId,
                extraValues: { paymentMethod: source.paymentMethod },
                lines: source.lineItems.map((li) => ({
                  key: Math.random().toString(36).slice(2),
                  shopItemId: li.shopItemId,
                  description: li.description,
                  quantity: Number(li.quantity),
                  unitPrice: Number(li.unitPrice),
                  taxRateId: li.taxRateId,
                })),
              }
            : undefined
        }
      />
    </div>
  );
}
