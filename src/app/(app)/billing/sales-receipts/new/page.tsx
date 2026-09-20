import { prisma } from '@/lib/prisma';
import SalesReceiptFormClient from '@/components/billing/sales-receipt-form-client';

export default async function NewSalesReceiptPage() {
  const [customers, shopItems, taxRates, settings] = await Promise.all([
    prisma.customer.findMany({ where: { deletedAt: null }, orderBy: { displayName: 'asc' } }),
    prisma.shopItem.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.taxRate.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">New Sales Receipt</h1>
        <p className="text-sm text-slate-500">Use this for a sale that&apos;s paid in full right away.</p>
      </div>
      <SalesReceiptFormClient
        customers={customers.map((c) => ({ id: c.id, name: c.displayName }))}
        shopItems={shopItems.map((s) => ({ id: s.id, sku: s.sku, name: s.name, unitPrice: s.unitPrice.toString() }))}
        taxRates={taxRates.map((t) => ({ id: t.id, name: t.name, ratePercent: t.ratePercent.toString() }))}
        currency={settings?.currencyCode ?? 'SCR'}
      />
    </div>
  );
}
