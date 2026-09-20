'use client';

import SimpleDocForm, { PartyOption, ShopItemOption, TaxRateOption } from '@/components/shared/simple-doc-form';

export default function SalesOrderFormClient({
  customers,
  shopItems,
  taxRates,
  currency,
}: {
  customers: PartyOption[];
  shopItems: ShopItemOption[];
  taxRates: TaxRateOption[];
  currency: string;
}) {
  return (
    <SimpleDocForm
      title="New Sales Order"
      partyLabel="Customer"
      parties={customers}
      shopItems={shopItems}
      taxRates={taxRates}
      currency={currency}
      apiUrl="/api/sales-orders"
      redirectPath="/billing/sales-orders"
      extraFields={({ values, set }) => (
        <div>
          <label className="label">Global Discount (%)</label>
          <input
            type="number"
            step="0.01"
            className="input"
            value={values.globalDiscountPercent ?? 0}
            onChange={(e) => set('globalDiscountPercent', parseFloat(e.target.value) || 0)}
          />
        </div>
      )}
      buildExtraPayload={(v) => ({ globalDiscountPercent: v.globalDiscountPercent || 0 })}
      submitLabel="Save Sales Order"
    />
  );
}
