// Technician Incentive Program (Session 16) — shared calc used by:
//  - the "Convert to Draft Invoice" flow (auto-populating line items from a
//    completed Work Order's serviceLines)
//  - the technician Incentive tab (monthly equipment-serviced + earnings)
//  - the technician payment-bridge "Receiving Payment" draft-invoice step
//
// Kept framework-free (no Prisma types) so it's easy to unit-reason about
// and reuse from both server components and API routes — callers pass in
// plain rows already fetched from the DB.

export type ServiceLine = {
  key: string;
  label: string;
  quantity: number;
  kind: 'STANDARD' | 'CUSTOM' | 'WORKSHOP';
};

export type IncentiveRateRow = {
  key: string;
  label: string;
  shopItemId: string | null;
  fractionOverride: number | null; // already-parsed Decimal, or null
  flatAmount: number | null;
  bundledShopItemId: string | null;
  bundledQuantityPerUnit: number;
  active: boolean;
};

export type ShopItemRef = {
  id: string;
  sku: string;
  name: string;
  unitPrice: number;
  taxable: boolean;
};

/** Looks up the IncentiveRate row for a service line: exact key match, or
 * the "_custom" catch-all for a technician's free-text CUSTOM line. */
export function resolveRate(line: ServiceLine, ratesByKey: Map<string, IncentiveRateRow>): IncentiveRateRow | null {
  const exact = ratesByKey.get(line.key);
  if (exact) return exact;
  if (line.kind === 'CUSTOM') return ratesByKey.get('_custom') ?? null;
  return null;
}

export type DraftInvoiceLine = {
  shopItemId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  /** true when this line couldn't be priced from the catalog and needs a
   * human to fill in a price before the invoice is usable. */
  needsPricing: boolean;
  sourceKey: string; // the serviceLines key this line came from, for traceability
};

/**
 * Turns a completed Work Order's serviceLines into draft invoice line
 * items, auto-bundling add-ons (e.g. F/Ext servicing -> +1 Service Tags per
 * unit). Every service line always produces at least one output line, even
 * when unpriced, so nothing from the job is silently dropped — an unpriced
 * line just needs a sales/admin human to fill in a price (or the admin to
 * finish configuring that key under Team > Incentive Rates).
 */
export function buildDraftInvoiceLines(
  serviceLines: ServiceLine[],
  ratesByKey: Map<string, IncentiveRateRow>,
  shopItemsById: Map<string, ShopItemRef>
): DraftInvoiceLine[] {
  const out: DraftInvoiceLine[] = [];
  for (const line of serviceLines) {
    const rate = resolveRate(line, ratesByKey);
    const shopItem = rate?.shopItemId ? shopItemsById.get(rate.shopItemId) : undefined;
    out.push({
      shopItemId: shopItem?.id ?? null,
      description: shopItem?.name ?? line.label,
      quantity: line.quantity,
      unitPrice: shopItem?.unitPrice ?? 0,
      needsPricing: !shopItem,
      sourceKey: line.key,
    });
    if (rate?.bundledShopItemId) {
      const bundled = shopItemsById.get(rate.bundledShopItemId);
      if (bundled) {
        out.push({
          shopItemId: bundled.id,
          description: bundled.name,
          quantity: line.quantity * (rate.bundledQuantityPerUnit || 1),
          unitPrice: bundled.unitPrice,
          needsPricing: false,
          sourceKey: `${line.key}:bundled`,
        });
      }
    }
  }
  return out;
}

export type IncentiveLineResult = {
  key: string;
  label: string;
  quantity: number;
  unitPrice: number;
  lineRevenue: number;
  incentiveAmount: number;
  needsPricing: boolean;
};

/**
 * Computes the technician's incentive earned on one Work Order's serviced
 * lines. Only the primary (tapped) service counts toward incentive — a
 * bundled add-on (e.g. Service Tags riding along with F/Ext) is revenue on
 * the invoice but doesn't separately earn incentive, since it isn't a
 * distinct service the technician performed.
 */
export function computeIncentiveForServiceLines(
  serviceLines: ServiceLine[],
  ratesByKey: Map<string, IncentiveRateRow>,
  shopItemsById: Map<string, ShopItemRef>,
  defaultFraction: number
): IncentiveLineResult[] {
  return serviceLines.map((line) => {
    const rate = resolveRate(line, ratesByKey);
    const shopItem = rate?.shopItemId ? shopItemsById.get(rate.shopItemId) : undefined;
    const unitPrice = shopItem?.unitPrice ?? 0;
    const lineRevenue = unitPrice * line.quantity;
    let incentiveAmount = 0;
    if (rate?.flatAmount != null) {
      incentiveAmount = rate.flatAmount * line.quantity;
    } else {
      const fraction = rate?.fractionOverride ?? defaultFraction;
      incentiveAmount = lineRevenue * fraction;
    }
    return {
      key: line.key,
      label: shopItem?.name ?? line.label,
      quantity: line.quantity,
      unitPrice,
      lineRevenue,
      incentiveAmount,
      needsPricing: !shopItem,
    };
  });
}
