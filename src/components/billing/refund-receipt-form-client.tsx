'use client';

import SimpleDocForm, { PartyOption, ShopItemOption } from '@/components/shared/simple-doc-form';

const METHODS = ['CASH', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'OTHER'];

export default function RefundReceiptFormClient({
  customers,
  shopItems,
  currency,
}: {
  customers: PartyOption[];
  shopItems: ShopItemOption[];
  currency: string;
}) {
  return (
    <SimpleDocForm
      title="New Refund Receipt"
      partyLabel="Customer"
      parties={customers}
      shopItems={shopItems}
      taxRates={[]}
      currency={currency}
      apiUrl="/api/refund-receipts"
      redirectPath="/billing/refund-receipts"
      extraFields={({ values, set }) => (
        <>
          <div>
            <label className="label">Method</label>
            <select className="input" value={values.method ?? 'CASH'} onChange={(e) => set('method', e.target.value)}>
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Reason</label>
            <input className="input" value={values.reason ?? ''} onChange={(e) => set('reason', e.target.value)} />
          </div>
        </>
      )}
      buildExtraPayload={(v) => ({ method: v.method || 'CASH', reason: v.reason || undefined })}
      submitLabel="Save Refund Receipt"
    />
  );
}
