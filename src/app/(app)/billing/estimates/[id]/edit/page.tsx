import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import EstimateForm, { EstimateFormInitial } from '@/components/billing/estimate-form';

export default async function EditEstimatePage({ params }: { params: { id: string } }) {
  const [estimate, customers, shopItems, taxRates, settings] = await Promise.all([
    prisma.estimate.findUnique({
      where: { id: params.id },
      include: { lineItems: { orderBy: { sortOrder: 'asc' } } },
    }),
    prisma.customer.findMany({ where: { deletedAt: null }, orderBy: { displayName: 'asc' } }),
    prisma.shopItem.findMany({ where: { active: true }, orderBy: { sku: 'asc' } }),
    prisma.taxRate.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
  ]);
  if (!estimate) notFound();

  const initial: EstimateFormInitial = {
    customerId: estimate.customerId,
    expiryDate: estimate.expiryDate ? estimate.expiryDate.toISOString().slice(0, 10) : '',
    notes: estimate.notes ?? '',
    lines: estimate.lineItems.map((li) => ({
      key: li.id,
      shopItemId: li.shopItemId,
      description: li.description,
      quantity: Number(li.quantity),
      unitPrice: Number(li.unitPrice),
      discountPercent: Number(li.discountPercent),
      taxRateId: li.taxRateId,
    })),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">Edit Estimate {estimate.estimateNumber}</h1>
        <p className="text-sm text-slate-500">Changes are saved to this estimate in place — its number stays the same.</p>
      </div>
      <EstimateForm
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
        estimateId={estimate.id}
        initial={initial}
      />
    </div>
  );
}
