import { prisma } from './prisma';

// Session 22, round 14 — turning a sale of trackable safety equipment
// (fire extinguisher, fire blanket, hose reel, smoke/heat detector) into
// next year's servicing outreach.
//
// The app already computes, for every ACTIVE Equipment row, a
// `nextDueDate = (lastServiceDate ?? installDate) + intervalMonths` and
// surfaces anything within 30 days on the Outreach "Due Soon" bucket (see
// src/lib/scheduling.ts) — and an existing piece of equipment's
// lastServiceDate already gets refreshed automatically whenever a
// technician logs a WorkOrderInspectionItem against it (see
// api/work-orders/[id]/inspection-items/route.ts). Both of those already
// give sales the "reminder 1 month before it's due again" behavior asked
// for, covering the "existing servicing done this year" half of the
// request.
//
// What was missing: nothing ever created an Equipment row in the first
// place when one of these items was actually *sold* — an invoice or sales
// receipt line only ever touched the ShopItem catalog, never the
// customer's own Equipment list, so a brand-new fire extinguisher never
// entered the outreach radar for its first annual service.
//
// This helper is called from every place a real sale gets recorded (a
// desk-created Invoice, a Sales Receipt, a technician's field-raised
// Invoice, and an Estimate converted to an Invoice) right after that
// document's line items are written. Only ShopItems explicitly tagged
// with an `equipmentCategory` (set from Products & Services — see
// shop-items-manager.tsx) count; free-text lines and untagged catalog
// items (accessories, parts, servicing labor charges) are left alone.
//
// Deliberately scoped to document *creation* only, not later edits — if a
// tracked item is added to an already-saved Invoice/Sales Receipt via its
// edit screen, or the sale is later voided/deleted, no Equipment record is
// created or reversed automatically. Flagged here plainly as a known
// limitation rather than silently glossed over.
export type SoldLine = {
  shopItemId?: string | null;
  quantity: number | string;
};

export async function createEquipmentForSoldLines(params: {
  customerId: string;
  siteId?: string | null;
  saleDate: Date;
  lines: SoldLine[];
}): Promise<void> {
  const { customerId, siteId, saleDate, lines } = params;

  const shopItemIds = [...new Set(lines.map((l) => l.shopItemId).filter((id): id is string => !!id))];
  if (shopItemIds.length === 0) return;

  const trackedItems = await prisma.shopItem.findMany({
    where: { id: { in: shopItemIds }, equipmentCategory: { not: null } },
    select: { id: true, equipmentCategory: true },
  });
  if (trackedItems.length === 0) return;

  const categoryByItemId = new Map(trackedItems.map((i) => [i.id, i.equipmentCategory!]));
  const categoriesNeeded = [...new Set(trackedItems.map((i) => i.equipmentCategory!))];

  const typeCatalog = await prisma.equipmentTypeCatalog.findMany({
    where: { category: { in: categoriesNeeded } },
  });
  const catalogByCategory = new Map(typeCatalog.map((c) => [c.category, c]));

  for (const line of lines) {
    if (!line.shopItemId) continue;
    const category = categoryByItemId.get(line.shopItemId);
    if (!category) continue;

    const catalog = catalogByCategory.get(category);
    // One Equipment row per physical unit sold, not one row for the whole
    // line — "sold 3 fire extinguishers" should put 3 separate units on
    // the outreach radar, each due for its own first service.
    const qty = Math.max(1, Math.round(Number(line.quantity) || 1));

    for (let i = 0; i < qty; i++) {
      await prisma.equipment.create({
        data: {
          customerId,
          siteId: siteId || null,
          category,
          typeCatalogId: catalog?.id ?? null,
          installDate: saleDate,
          intervalMonths: catalog?.defaultIntervalMonths ?? 12,
          status: 'ACTIVE',
        },
      });
    }
  }
}
