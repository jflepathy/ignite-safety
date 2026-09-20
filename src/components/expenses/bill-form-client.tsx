'use client';

import SimpleDocForm, { PartyOption, ShopItemOption } from '@/components/shared/simple-doc-form';

export default function BillFormClient({
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
      title="New Bill"
      partyLabel="Supplier"
      parties={suppliers}
      shopItems={shopItems}
      taxRates={[]}
      currency={currency}
      apiUrl="/api/bills"
      redirectPath="/expenses/bills"
      extraFields={({ values, set }) => (
        <>
          <div>
            <label className="label">Supplier&apos;s Bill / Ref #</label>
            <input className="input" value={values.supplierRef ?? ''} onChange={(e) => set('supplierRef', e.target.value)} />
          </div>
          <div>
            <label className="label">Due Date</label>
            <input type="date" className="input" value={values.dueDate ?? ''} onChange={(e) => set('dueDate', e.target.value)} />
          </div>
          <div>
            <label className="label">Terms</label>
            <input
              className="input"
              placeholder="e.g. Net 30"
              value={values.terms ?? ''}
              onChange={(e) => set('terms', e.target.value)}
            />
          </div>
        </>
      )}
      buildExtraPayload={(v) => ({
        supplierRef: v.supplierRef || undefined,
        dueDate: v.dueDate || undefined,
        terms: v.terms || undefined,
      })}
      submitLabel="Save Bill"
    />
  );
}
