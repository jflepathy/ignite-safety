import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { formatMoney } from '@/lib/money';

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

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3 text-right">Qty on Hand</th>
              <th className="px-4 py-3 text-right">Reorder Point</th>
              <th className="px-4 py-3 text-right">Unit Cost</th>
              <th className="px-4 py-3 text-right">Unit Price</th>
            </tr>
          </thead>
          <tbody>
            {inventoryItems.map((i) => {
              const low = i.reorderPoint != null && (i.quantityOnHand ?? 0) <= (i.reorderPoint ?? 0);
              return (
                <tr key={i.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-500">{i.sku}</td>
                  <td className="px-4 py-3 font-medium text-ink-900">{i.name}</td>
                  <td className={`px-4 py-3 text-right font-medium ${low ? 'text-red-600' : ''}`}>{i.quantityOnHand ?? 0}</td>
                  <td className="px-4 py-3 text-right text-slate-500">{i.reorderPoint ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-500">{i.cost ? formatMoney(i.cost.toString(), currency) : '—'}</td>
                  <td className="px-4 py-3 text-right">{formatMoney(i.unitPrice.toString(), currency)}</td>
                </tr>
              );
            })}
            {inventoryItems.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  No items marked as inventory-tracked yet. Set an item&apos;s type to Inventory in Products &amp; Services.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
