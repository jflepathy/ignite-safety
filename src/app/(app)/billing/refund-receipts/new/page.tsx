import { prisma } from '@/lib/prisma';
import RefundReceiptFormClient from '@/components/billing/refund-receipt-form-client';

export default async function NewRefundReceiptPage() {
  const [customers, shopItems, settings] = await Promise.all([
    prisma.customer.findMany({ where: { deletedAt: null }, orderBy: { displayName: 'asc' } }),
    prisma.shopItem.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">New Refund Receipt</h1>
        <p className="text-sm text-slate-500">Record money returned to a customer.</p>
      </div>
      <RefundReceiptFormClient
        customers={customers.map((c) => ({ id: c.id, name: c.displayName }))}
        shopItems={shopItems.map((s) => ({ id: s.id, sku: s.sku, name: s.name, unitPrice: s.unitPrice.toString() }))}
        currency={settings?.currencyCode ?? 'SCR'}
      />
    </div>
  );
}
