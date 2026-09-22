'use client';

import SimpleDocForm, { PartyOption, ShopItemOption, TaxRateOption } from '@/components/shared/simple-doc-form';

const METHODS = ['CASH', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'OTHER'];

export default function SalesReceiptFormClient({
  customers,
  shopItems,
  taxRates,
  currency,
  mode = 'create',
  recordId,
  initial,
}: {
  customers: PartyOption[];
  shopItems: ShopItemOption[];
  taxRates: TaxRateOption[];
  currency: string;
  mode?: 'create' | 'edit';
  recordId?: string;
  initial?: {
    partyId?: string;
    lines?: { key: string; shopItemId: string | null; description: string; quantity: number; unitPrice: number; taxRateId: string | null }[];
    extraValues?: Record<string, any>;
  };
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
      enablePartyCombobox
      printAfterSaveDefault
      mode={mode}
      recordId={recordId}
      initial={initial}
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
