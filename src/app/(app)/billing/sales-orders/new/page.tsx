import { prisma } from '@/lib/prisma';
import SalesOrderFormClient from '@/components/billing/sales-order-form-client';

export default async function NewSalesOrderPage() {
  const [customers, shopItems, taxRates, settings] = await Promise.all([
    prisma.customer.findMany({ where: { deletedAt: null }, orderBy: { displayName: 'asc' } }),
    prisma.shopItem.findMany({ where: { active: true }, orderBy: { sku: 'asc' } }),
    prisma.taxRate.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">New Sales Order</h1>
        <p className="text-sm text-slate-500">Confirm the order now, invoice the customer later.</p>
      </div>
      <SalesOrderFormClient
        customers={customers.map((c) => ({ id: c.id, name: c.displayName }))}
        shopItems={shopItems.map((s) => ({ id: s.id, sku: s.sku, name: s.name, unitPrice: s.unitPrice.toString() }))}
        taxRates={taxRates.map((t) => ({ id: t.id, name: t.name, ratePercent: t.ratePercent.toString() }))}
        currency={settings?.currencyCode ?? 'SCR'}
      />
    </div>
  );
}
