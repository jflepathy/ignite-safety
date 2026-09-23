import { prisma } from '@/lib/prisma';
import InvoiceForm from '@/components/billing/invoice-form';
import { buildDraftInvoiceLines, type ServiceLine } from '@/lib/incentives';

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: { workOrderId?: string };
}) {
  const [customers, shopItems, taxRates, settings, workOrder, incentiveRates] = await Promise.all([
    prisma.customer.findMany({ where: { deletedAt: null }, orderBy: { displayName: 'asc' } }),
    prisma.shopItem.findMany({ where: { active: true }, orderBy: { sku: 'asc' } }),
    prisma.taxRate.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
    searchParams.workOrderId
      ? prisma.workOrder.findUnique({ where: { id: searchParams.workOrderId } })
      : null,
    prisma.incentiveRate.findMany({ where: { active: true } }),
  ]);

  // Auto-populate the draft invoice's line items from the Work Order's
  // recorded serviceLines (Session 16), using the admin-configured
  // Incentive Rates catalog mapping. Sales/admin still review and confirm
  // before saving -- nothing here is final until they click Save.
  let autoLines: { shopItemId: string | null; description: string; quantity: number; unitPrice: number }[] = [];
  let hasUnpriced = false;
  if (workOrder && Array.isArray(workOrder.serviceLines) && (workOrder.serviceLines as any[]).length > 0) {
    const shopItemsById = new Map(shopItems.map((s) => [s.id, { id: s.id, sku: s.sku, name: s.name, unitPrice: Number(s.unitPrice), taxable: s.taxable }]));
    const ratesByKey = new Map(
      incentiveRates.map((r) => [
        r.key,
        {
          key: r.key,
          label: r.label,
          shopItemId: r.shopItemId,
          fractionOverride: r.fractionOverride != null ? Number(r.fractionOverride) : null,
          flatAmount: r.flatAmount != null ? Number(r.flatAmount) : null,
          bundledShopItemId: r.bundledShopItemId,
          bundledQuantityPerUnit: Number(r.bundledQuantityPerUnit),
          active: r.active,
        },
      ])
    );
    const built = buildDraftInvoiceLines(workOrder.serviceLines as unknown as ServiceLine[], ratesByKey, shopItemsById);
    autoLines = built.map((l) => ({ shopItemId: l.shopItemId, description: l.description, quantity: l.quantity, unitPrice: l.unitPrice }));
    hasUnpriced = built.some((l) => l.needsPricing);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">New Invoice</h1>
        <p className="text-sm text-slate-500">
          {workOrder
            ? `Billing for completed work order ${workOrder.woNumber}${autoLines.length ? ' — line items auto-filled from the job, review before saving.' : ''}`
            : 'Manually created — nothing is sent until you choose to.'}
        </p>
        {hasUnpriced && (
          <p className="mt-1 text-sm text-amber-600">
            One or more services on this job aren't linked to a catalog price yet — fill in the price on those lines,
            or map them under Team &gt; Incentive Rates for next time.
          </p>
        )}
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
        initialLines={autoLines}
      />
    </div>
  );
}
