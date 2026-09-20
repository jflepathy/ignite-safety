import { prisma } from '@/lib/prisma';
import ShopItemsManager from '@/components/admin/shop-items-manager';

export default async function CatalogPage() {
  const [shopItems, settings] = await Promise.all([
    prisma.shopItem.findMany({ orderBy: { name: 'asc' } }),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">Equipment & Pricing Catalog</h1>
        <p className="text-sm text-slate-500">
          Shop items, unit prices and service charge templates used across invoices, estimates and work orders.
        </p>
      </div>
      <ShopItemsManager
        items={shopItems.map((i) => ({
          id: i.id,
          sku: i.sku,
          name: i.name,
          category: i.category,
          itemType: i.itemType,
          unitPrice: i.unitPrice.toString(),
          quantityOnHand: i.quantityOnHand,
          reorderPoint: i.reorderPoint,
          taxable: i.taxable,
          active: i.active,
        }))}
        currency={settings?.currencyCode ?? 'SCR'}
      />
    </div>
  );
}
