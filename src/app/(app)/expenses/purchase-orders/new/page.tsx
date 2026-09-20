import { prisma } from '@/lib/prisma';
import PurchaseOrderFormClient from '@/components/expenses/purchase-order-form-client';

export default async function NewPurchaseOrderPage() {
  const [suppliers, shopItems, settings] = await Promise.all([
    prisma.supplier.findMany({ where: { deletedAt: null }, orderBy: { displayName: 'asc' } }),
    prisma.shopItem.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">New Purchase Order</h1>
        <p className="text-sm text-slate-500">Send this to a supplier before stock arrives.</p>
      </div>
      <PurchaseOrderFormClient
        suppliers={suppliers.map((s) => ({ id: s.id, name: s.displayName }))}
        shopItems={shopItems.map((s) => ({ id: s.id, sku: s.sku, name: s.name, unitPrice: s.unitPrice.toString() }))}
        currency={settings?.currencyCode ?? 'SCR'}
      />
    </div>
  );
}
