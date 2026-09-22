import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import SalesReceiptFormClient from '@/components/billing/sales-receipt-form-client';

export default async function EditSalesReceiptPage({ params }: { params: { id: string } }) {
  const [receipt, customers, shopItems, taxRates, settings] = await Promise.all([
    prisma.salesReceipt.findUnique({
      where: { id: params.id },
      include: { lineItems: true },
    }),
    prisma.customer.findMany({ where: { deletedAt: null }, orderBy: { displayName: 'asc' } }),
    prisma.shopItem.findMany({ where: { active: true }, orderBy: { sku: 'asc' } }),
    prisma.taxRate.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
  ]);
  if (!receipt) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">Edit Sales Receipt {receipt.receiptNumber}</h1>
        <p className="text-sm text-slate-500">Changes are saved to this receipt in place — its number stays the same.</p>
      </div>
      <SalesReceiptFormClient
        customers={customers.map((c) => ({ id: c.id, name: c.displayName }))}
        shopItems={shopItems.map((s) => ({ id: s.id, sku: s.sku, name: s.name, unitPrice: s.unitPrice.toString() }))}
        taxRates={taxRates.map((t) => ({ id: t.id, name: t.name, ratePercent: t.ratePercent.toString() }))}
        currency={settings?.currencyCode ?? 'SCR'}
        mode="edit"
        recordId={receipt.id}
        initial={{
          partyId: receipt.customerId,
          extraValues: { paymentMethod: receipt.paymentMethod },
          lines: receipt.lineItems.map((li) => ({
            key: li.id,
            shopItemId: li.shopItemId,
            description: li.description,
            quantity: Number(li.quantity),
            unitPrice: Number(li.unitPrice),
            taxRateId: li.taxRateId,
          })),
        }}
      />
    </div>
  );
}
