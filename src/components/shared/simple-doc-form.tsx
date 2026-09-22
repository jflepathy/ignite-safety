'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import CustomerCombobox from '@/components/shared/customer-combobox';

export type PartyOption = { id: string; name: string };
export type ShopItemOption = { id: string; sku: string; name: string; unitPrice: string };
export type TaxRateOption = { id: string; name: string; ratePercent: string };

type Line = {
  key: string;
  shopItemId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRateId: string | null;
};

function emptyLine(): Line {
  return { key: Math.random().toString(36).slice(2), shopItemId: null, description: '', quantity: 1, unitPrice: 0, taxRateId: null };
}

/**
 * A compact, reusable create-form for the simpler transaction types (Bill,
 * Purchase Order, Sales Order, Sales Receipt, Refund Receipt, Credit Note).
 * Not tax/discount-configurable to the same depth as the main Invoice form —
 * those go through InvoiceForm instead.
 */
export default function SimpleDocForm({
  title,
  partyLabel,
  parties,
  shopItems,
  taxRates,
  currency,
  apiUrl,
  redirectPath,
  extraFields,
  buildExtraPayload,
  submitLabel = 'Save',
  printableDetailPath,
  documentLabel = 'Document',
  enablePartyCombobox = false,
  printAfterSaveDefault = false,
  mode = 'create',
  recordId,
  initial,
}: {
  title: string;
  partyLabel: string; // "Customer" or "Supplier"
  parties: PartyOption[];
  shopItems: ShopItemOption[];
  taxRates: TaxRateOption[];
  currency: string;
  apiUrl: string;
  redirectPath: string;
  extraFields?: (props: { values: Record<string, any>; set: (k: string, v: any) => void }) => React.ReactNode;
  buildExtraPayload?: (values: Record<string, any>) => Record<string, any>;
  submitLabel?: string;
  /** When provided (e.g. "/billing/sales-receipts"), a "Do you want to
   * print?" prompt is shown after saving, and "Print" opens
   * `${printableDetailPath}/${newRecordId}?print=1`. Omit to keep the old
   * immediate-redirect behavior (used by document types with no dedicated
   * print-ready detail page, e.g. Credit Notes, Bills, Purchase Orders). */
  printableDetailPath?: string;
  documentLabel?: string;
  /** Swaps the plain party <select> for the type-to-filter combobox with
   * inline "+ Add new customer" (Session 10). Only meaningful when the
   * party is a Customer (it POSTs to /api/customers) — leave off for
   * Supplier-context forms like Bill/Purchase Order. */
  enablePartyCombobox?: boolean;
  /** Pre-checks "Print after saving" (Session 10). Only has an effect when
   * printableDetailPath is set, since that's what makes printing possible. */
  printAfterSaveDefault?: boolean;
  /** 'edit' loads from `initial` and PATCHes `apiUrl/recordId` instead of
   * POSTing a new record (Session 10 — Sales Receipt edit). */
  mode?: 'create' | 'edit';
  recordId?: string;
  initial?: { partyId?: string; lines?: Line[]; extraValues?: Record<string, any> };
}) {
  const router = useRouter();
  const [partyId, setPartyId] = useState(initial?.partyId ?? parties[0]?.id ?? '');
  const [partyOptions, setPartyOptions] = useState(parties);
  const [lines, setLines] = useState<Line[]>(initial?.lines?.length ? initial.lines : [emptyLine()]);
  const [extraValues, setExtraValues] = useState<Record<string, any>>(initial?.extraValues ?? {});
  const [printAfterSave, setPrintAfterSave] = useState(printAfterSaveDefault);
  const [submitting, setSubmitting] = useState<'save' | 'print' | null>(null);
  const [error, setError] = useState('');

  function setExtra(k: string, v: any) {
    setExtraValues((prev) => ({ ...prev, [k]: v }));
  }
  function updateLine(key: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }
  function applyShopItem(key: string, shopItemId: string) {
    const item = shopItems.find((s) => s.id === shopItemId);
    if (!item) return;
    updateLine(key, { shopItemId: item.id, description: item.name, unitPrice: parseFloat(item.unitPrice) });
  }

  const totals = useMemo(() => {
    const showTax = taxRates.length > 0;
    let subtotal = 0;
    let tax = 0;
    const computed = lines.map((l) => {
      const gross = l.quantity * l.unitPrice;
      const rate = showTax && l.taxRateId ? parseFloat(taxRates.find((t) => t.id === l.taxRateId)?.ratePercent ?? '0') / 100 : 0;
      const lineTax = gross * rate;
      subtotal += gross;
      tax += lineTax;
      return { ...l, lineTotal: gross + lineTax };
    });
    return { computed, subtotal, tax, total: subtotal + tax };
  }, [lines, taxRates]);

  async function submit(action: 'save' | 'print' = 'save') {
    setSubmitting(action);
    setError('');
    try {
      const isEdit = mode === 'edit';
      const extra = buildExtraPayload ? buildExtraPayload(extraValues) : extraValues;
      const res = await fetch(isEdit ? `${apiUrl}/${recordId}` : apiUrl, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...extra,
          lineItems: lines.map((l) => ({
            description: l.description,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            shopItemId: l.shopItemId,
            taxRateId: l.taxRateId,
            taxRatePercent: l.taxRateId ? parseFloat(taxRates.find((t) => t.id === l.taxRateId)?.ratePercent ?? '0') : 0,
          })),
          ...(partyId ? { customerId: partyId, supplierId: partyId } : {}),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ? JSON.stringify(body.error) : 'Failed to save');
      }
      const saved = await res.json().catch(() => null);
      if (isEdit && recordId) {
        const shouldPrint = action === 'print' || printAfterSave;
        router.push(`${printableDetailPath ?? redirectPath}/${recordId}${shouldPrint && printableDetailPath ? '?print=1' : ''}`);
        router.refresh();
      } else if (printableDetailPath && saved?.id) {
        const shouldPrint = action === 'print' || printAfterSave;
        router.push(`${printableDetailPath}/${saved.id}${shouldPrint ? '?print=1' : ''}`);
        router.refresh();
      } else {
        router.push(redirectPath);
        router.refresh();
      }
    } catch (e: any) {
      setError(e.message);
      setSubmitting(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="card grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
        <div>
          {enablePartyCombobox ? (
            <CustomerCombobox
              customers={partyOptions.map((p) => ({ id: p.id, name: p.name }))}
              value={partyId}
              onChange={setPartyId}
              onCreated={(c) => setPartyOptions((prev) => [...prev, { id: c.id, name: c.name }])}
              label={partyLabel}
            />
          ) : (
            <>
              <label className="label">{partyLabel}</label>
              <select className="input" value={partyId} onChange={(e) => setPartyId(e.target.value)}>
                {partyOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
        {extraFields?.({ values: extraValues, set: setExtra })}
      </div>

      <div className="card p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink-900">Line Items</h2>
          <button type="button" className="btn-secondary" onClick={() => setLines((p) => [...p, emptyLine()])}>
            + Add line
          </button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-500">
              <th className="w-56 py-2">Item</th>
              <th className="py-2">Description</th>
              <th className="w-20 py-2 text-right">Qty</th>
              <th className="w-28 py-2 text-right">Unit Price</th>
              {taxRates.length > 0 && <th className="w-32 py-2">Tax</th>}
              <th className="w-28 py-2 text-right">Total</th>
              <th className="w-8 py-2" />
            </tr>
          </thead>
          <tbody>
            {totals.computed.map((line) => (
              <tr key={line.key} className="border-t border-slate-100">
                <td className="py-2 pr-2">
                  <select
                    className="input"
                    value={line.shopItemId ?? ''}
                    onChange={(e) => (e.target.value ? applyShopItem(line.key, e.target.value) : updateLine(line.key, { shopItemId: null }))}
                  >
                    <option value="">Custom</option>
                    {shopItems.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.sku} — {s.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-2 pr-2">
                  <input className="input" value={line.description} onChange={(e) => updateLine(line.key, { description: e.target.value })} />
                </td>
                <td className="py-2 pr-2">
                  <input
                    type="number"
                    className="input text-right"
                    value={line.quantity}
                    onChange={(e) => updateLine(line.key, { quantity: parseFloat(e.target.value) || 0 })}
                  />
                </td>
                <td className="py-2 pr-2">
                  <input
                    type="number"
                    step="0.01"
                    className="input text-right"
                    value={line.unitPrice}
                    onChange={(e) => updateLine(line.key, { unitPrice: parseFloat(e.target.value) || 0 })}
                  />
                </td>
                {taxRates.length > 0 && (
                  <td className="py-2 pr-2">
                    <select className="input" value={line.taxRateId ?? ''} onChange={(e) => updateLine(line.key, { taxRateId: e.target.value || null })}>
                      <option value="">No tax</option>
                      {taxRates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </td>
                )}
                <td className="py-2 text-right font-medium">{line.lineTotal.toFixed(2)}</td>
                <td className="py-2 text-right">
                  {lines.length > 1 && (
                    <button type="button" onClick={() => setLines((p) => p.filter((l) => l.key !== line.key))} className="text-slate-400 hover:text-red-600">
                      ✕
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-6 flex justify-end">
          <div className="w-64 space-y-1 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span>{totals.subtotal.toFixed(2)} {currency}</span>
            </div>
            {taxRates.length > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Tax</span>
                <span>{totals.tax.toFixed(2)} {currency}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-200 pt-1 text-base font-semibold">
              <span>Total</span>
              <span>{totals.total.toFixed(2)} {currency}</span>
            </div>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center justify-end gap-4">
        {printableDetailPath && (
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              checked={printAfterSave}
              onChange={(e) => setPrintAfterSave(e.target.checked)}
            />
            Print after saving
          </label>
        )}
        <div className="flex gap-2">
          {mode === 'edit' ? (
            <button className="btn-primary" disabled={!!submitting} onClick={() => submit('save')}>
              {submitting === 'save' ? 'Saving…' : 'Save Changes'}
            </button>
          ) : printableDetailPath ? (
            <>
              <button className="btn-secondary" disabled={!!submitting} onClick={() => submit('save')}>
                {submitting === 'save' ? 'Saving…' : 'Save'}
              </button>
              <button className="btn-primary" disabled={!!submitting} onClick={() => submit('print')}>
                {submitting === 'print' ? 'Saving…' : 'Save & Print'}
              </button>
            </>
          ) : (
            <button className="btn-primary" disabled={!!submitting} onClick={() => submit('save')}>
              {submitting === 'save' ? 'Saving…' : submitLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
