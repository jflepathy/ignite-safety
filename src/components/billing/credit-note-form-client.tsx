'use client';

import SimpleDocForm, { PartyOption, ShopItemOption, TaxRateOption } from '@/components/shared/simple-doc-form';

export default function CreditNoteFormClient({
  customers,
  shopItems,
  taxRates,
  currency,
  invoiceId,
}: {
  customers: PartyOption[];
  shopItems: ShopItemOption[];
  taxRates: TaxRateOption[];
  currency: string;
  invoiceId?: string;
}) {
  return (
    <SimpleDocForm
      title="New Credit Note"
      partyLabel="Customer"
      parties={customers}
      shopItems={shopItems}
      taxRates={taxRates}
      currency={currency}
      apiUrl="/api/credit-notes"
      redirectPath="/billing/credit-notes"
      extraFields={({ values, set }) => (
        <div>
          <label className="label">Reason</label>
          <input className="input" value={values.reason ?? ''} onChange={(e) => set('reason', e.target.value)} />
        </div>
      )}
      buildExtraPayload={(v) => ({ reason: v.reason || undefined, invoiceId })}
      submitLabel="Save Credit Note"
    />
  );
}
