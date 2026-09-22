import { prisma } from '@/lib/prisma';
import EstimateForm from '@/components/billing/estimate-form';

export default async function NewEstimatePage() {
  const [customers, shopItems, taxRates, settings] = await Promise.all([
    prisma.customer.findMany({ where: { deletedAt: null }, orderBy: { displayName: 'asc' } }),
    prisma.shopItem.findMany({ where: { active: true }, orderBy: { sku: 'asc' } }),
    prisma.taxRate.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
  ]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">New Estimate / Quote</h1>
        <p className="text-sm text-slate-500">Accepted estimates can be converted into a draft invoice with one click.</p>
      </div>
      <EstimateForm
        customers={customers.map((c) => ({ id: c.id, displayName: c.displayName }))}
        shopItems={shopItems.map((s) => ({ id: s.id, sku: s.sku, name: s.name, unitPrice: s.unitPrice.toString(), taxable: s.taxable }))}
        taxRates={taxRates.map((t) => ({ id: t.id, name: t.name, ratePercent: t.ratePercent.toString(), isDefault: t.isDefault }))}
        currency={settings?.currencyCode ?? 'SCR'}
      />
    </div>
  );
}
