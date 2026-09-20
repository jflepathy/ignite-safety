'use client';

import SimpleDocForm, { PartyOption, ShopItemOption } from '@/components/shared/simple-doc-form';

export default function PurchaseOrderFormClient({
  suppliers,
  shopItems,
  currency,
}: {
  suppliers: PartyOption[];
  shopItems: ShopItemOption[];
  currency: string;
}) {
  return (
    <SimpleDocForm
      title="New Purchase Order"
      partyLabel="Supplier"
      parties={suppliers}
      shopItems={shopItems}
      taxRates={[]}
      currency={currency}
      apiUrl="/api/purchase-orders"
      redirectPath="/expenses/purchase-orders"
      extraFields={({ values, set }) => (
        <div>
          <label className="label">Expected Date</label>
          <input
            type="date"
            className="input"
            value={values.expectedDate ?? ''}
            onChange={(e) => set('expectedDate', e.target.value)}
          />
        </div>
      )}
      buildExtraPayload={(v) => ({ expectedDate: v.expectedDate || undefined })}
      submitLabel="Save Purchase Order"
    />
  );
}
