import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import InventoryTable from '@/components/inventory/inventory-table';

export default async function InventoryPage() {
  const [items, settings] = await Promise.all([
    prisma.shopItem.findMany({ orderBy: { sku: 'asc' } }),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
  ]);
  const currency = settings?.currencyCode ?? 'SCR';
  const inventoryItems = items.filter((i) => i.itemType === 'INVENTORY');
  const lowStock = inventoryItems.filter((i) => i.reorderPoint != null && (i.quantityOnHand ?? 0) <= (i.reorderPoint ?? 0));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Inventory</h1>
          <p className="text-sm text-slate-500">Stock levels for tracked items. Non-inventory items and services live in Products &amp; Services.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/catalog" className="btn-secondary">
            Manage Items
          </Link>
          <Link href="/inventory/adjustments" className="btn-primary">
            Adjustments
          </Link>
        </div>
      </div>

      {lowStock.length > 0 && (
        <div className="card border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-800">{lowStock.length} item(s) at or below reorder point</p>
        </div>
      )}

      <InventoryTable
        items={inventoryItems.map((i) => ({
          id: i.id,
          sku: i.sku,
          name: i.name,
          quantityOnHand: i.quantityOnHand,
          reorderPoint: i.reorderPoint,
          cost: i.cost ? i.cost.toString() : null,
          unitPrice: i.unitPrice.toString(),
        }))}
        currency={currency}
      />
    </div>
  );
}
