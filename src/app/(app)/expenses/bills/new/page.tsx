import { prisma } from '@/lib/prisma';
import BillFormClient from '@/components/expenses/bill-form-client';

export default async function NewBillPage() {
  const [suppliers, shopItems, settings] = await Promise.all([
    prisma.supplier.findMany({ where: { deletedAt: null }, orderBy: { displayName: 'asc' } }),
    prisma.shopItem.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">New Bill</h1>
        <p className="text-sm text-slate-500">Record a supplier bill to pay later.</p>
      </div>
      <BillFormClient
        suppliers={suppliers.map((s) => ({ id: s.id, name: s.displayName }))}
        shopItems={shopItems.map((s) => ({ id: s.id, sku: s.sku, name: s.name, unitPrice: s.unitPrice.toString() }))}
        currency={settings?.currencyCode ?? 'SCR'}
      />
    </div>
  );
}
