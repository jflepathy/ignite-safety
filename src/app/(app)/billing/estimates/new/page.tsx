import { prisma } from '@/lib/prisma';
import EstimateForm, { type EstimateFormInitial } from '@/components/billing/estimate-form';

export default async function NewEstimatePage({ searchParams }: { searchParams: { duplicateFrom?: string } }) {
  const [customers, shopItems, taxRates, settings, source] = await Promise.all([
    prisma.customer.findMany({ where: { deletedAt: null }, orderBy: { displayName: 'asc' } }),
    prisma.shopItem.findMany({ where: { active: true }, orderBy: { sku: 'asc' } }),
    prisma.taxRate.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
    searchParams.duplicateFrom
      ? prisma.estimate.findUnique({ where: { id: searchParams.duplicateFrom }, include: { lineItems: { orderBy: { sortOrder: 'asc' } } } })
      : null,
  ]);
  const duplicateInitial: EstimateFormInitial | undefined = source
    ? {
        customerId: source.customerId,
        expiryDate: '',
        notes: source.notes ?? '',
        lines: source.lineItems.map((li) => ({
          key: Math.random().toString(36).slice(2),
          shopItemId: li.shopItemId,
          description: li.description,
          quantity: Number(li.quantity),
          unitPrice: Number(li.unitPrice),
          discountPercent: Number(li.discountPercent),
          taxRateId: li.taxRateId,
        })),
      }
    : undefined;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">New Estimate / Quote</h1>
        <p className="text-sm text-slate-500">
          {source
            ? `Copy of estimate ${source.estimateNumber} — review, then save as a new estimate.`
            : 'Accepted estimates can be converted into a draft invoice with one click.'}
        </p>
      </div>
      <EstimateForm
        customers={customers.map((c) => ({ id: c.id, displayName: c.displayName }))}
        shopItems={shopItems.map((s) => ({ id: s.id, sku: s.sku, name: s.name, unitPrice: s.unitPrice.toString(), taxable: s.taxable }))}
        taxRates={taxRates.map((t) => ({ id: t.id, name: t.name, ratePercent: t.ratePercent.toString(), isDefault: t.isDefault }))}
        currency={settings?.currencyCode ?? 'SCR'}
        initial={duplicateInitial}
      />
    </div>
  );
}
