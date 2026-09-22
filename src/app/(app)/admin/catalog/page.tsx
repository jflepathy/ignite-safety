import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { canEditModule } from '@/lib/edit-permissions-constants';
import ShopItemsManager from '@/components/admin/shop-items-manager';

export default async function CatalogPage() {
  const [shopItems, settings, session] = await Promise.all([
    prisma.shopItem.findMany({ orderBy: { sku: 'asc' } }),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
    getServerSession(authOptions),
  ]);
  const isAdmin = session?.user.role === 'ADMIN';
  const canEdit = canEditModule('productsServices', isAdmin, session?.user.editModules);

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
        canEdit={canEdit}
      />
    </div>
  );
}
