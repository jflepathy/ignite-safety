'use client';

import SimpleDocForm, { PartyOption, ShopItemOption, TaxRateOption } from '@/components/shared/simple-doc-form';

const METHODS = ['CASH', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'OTHER'];

export default function SalesReceiptFormClient({
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
      title="New Sales Receipt"
      partyLabel="Customer"
      parties={customers}
      shopItems={shopItems}
      taxRates={taxRates}
      currency={currency}
      apiUrl="/api/sales-receipts"
      redirectPath="/billing/sales-receipts"
      printableDetailPath="/billing/sales-receipts"
      documentLabel="Sales Receipt"
      extraFields={({ values, set }) => (
        <div>
          <label className="label">Payment Method</label>
          <select className="input" value={values.paymentMethod ?? 'CASH'} onChange={(e) => set('paymentMethod', e.target.value)}>
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {m.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>
      )}
      buildExtraPayload={(v) => ({ paymentMethod: v.paymentMethod || 'CASH' })}
      submitLabel="Save Sales Receipt"
    />
  );
}
