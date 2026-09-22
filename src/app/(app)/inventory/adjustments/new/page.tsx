import { prisma } from '@/lib/prisma';
import InventoryAdjustmentForm from '@/components/inventory/inventory-adjustment-form';

export default async function NewInventoryAdjustmentPage() {
  const items = await prisma.shopItem.findMany({ where: { active: true }, orderBy: { sku: 'asc' } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">New Inventory Adjustment</h1>
        <p className="text-sm text-slate-500">Correct stock on hand for a tracked item.</p>
      </div>
      <InventoryAdjustmentForm
        items={items.map((i) => ({ id: i.id, sku: i.sku, name: i.name, quantityOnHand: i.quantityOnHand ?? 0 }))}
      />
    </div>
  );
}
