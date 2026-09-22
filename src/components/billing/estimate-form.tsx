'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { computeDocumentTotals } from '@/lib/money';
import CustomerCombobox from '@/components/shared/customer-combobox';
import ItemCombobox from '@/components/shared/item-combobox';

type Customer = { id: string; displayName: string };
type ShopItem = { id: string; sku: string; name: string; unitPrice: string; taxable: boolean };
type TaxRate = { id: string; name: string; ratePercent: string; isDefault: boolean };

type Line = {
  key: string;
  shopItemId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  taxRateId: string | null;
};

function emptyLine(): Line {
  return {
    key: Math.random().toString(36).slice(2),
    shopItemId: null,
    description: '',
    quantity: 1,
    unitPrice: 0,
    discountPercent: 0,
    taxRateId: null,
  };
}

export default function EstimateForm({
  customers,
  shopItems,
  taxRates,
  currency,
}: {
  customers: Customer[];
  shopItems: ShopItem[];
  taxRates: TaxRate[];
  currency: string;
}) {
  const router = useRouter();
  const defaultTaxRate = taxRates.find((t) => t.isDefault) ?? taxRates[0];
  const [customerOptions, setCustomerOptions] = useState(customers);
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? '');
  const [expiryDate, setExpiryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [printAfterSave, setPrintAfterSave] = useState(true);
  const [submitting, setSubmitting] = useState<'save' | 'print' | null>(null);
  const [error, setError] = useState('');

  const totals = useMemo(
    () =>
      computeDocumentTotals(
        lines.map((l) => ({
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discountPercent: l.discountPercent,
          taxRatePercent: l.taxRateId
            ? parseFloat(taxRates.find((t) => t.id === l.taxRateId)?.ratePercent ?? '0')
            : 0,
        })),
        0
      ),
    [lines, taxRates]
  );

  function updateLine(key: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }
  function applyShopItem(key: string, shopItemId: string) {
    const item = shopItems.find((s) => s.id === shopItemId);
    if (!item) return;
    updateLine(key, {
      shopItemId: item.id,
      description: item.name,
      unitPrice: parseFloat(item.unitPrice),
      taxRateId: item.taxable ? defaultTaxRate?.id ?? null : null,
    });
  }
  function addLine() {
    setLines((p) => [...p, emptyLine()]);
  }
  // Selecting an item on the last line opens a fresh blank line beneath it.
  function selectShopItem(idx: number, key: string, shopItemId: string) {
    applyShopItem(key, shopItemId);
    if (idx === lines.length - 1) addLine();
  }

  async function submit(action: 'save' | 'print') {
    setSubmitting(action);
    setError('');
    try {
      const res = await fetch('/api/estimates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          expiryDate: expiryDate || undefined,
          notes,
          lineItems: lines.map((l) => ({
            shopItemId: l.shopItemId,
            description: l.description,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            discountPercent: l.discountPercent,
            taxRateId: l.taxRateId,
            taxRatePercent: l.taxRateId
              ? parseFloat(taxRates.find((t) => t.id === l.taxRateId)?.ratePercent ?? '0')
              : 0,
          })),
        }),
      });
      if (!res.ok) throw new Error('Failed to create estimate');
      const estimate = await res.json();
      const shouldPrint = action === 'print' || printAfterSave;
      router.push(`/billing/estimates/${estimate.id}${shouldPrint ? '?print=1' : ''}`);
      router.refresh();
    } catch (e: any) {
      setError(e.message);
      setSubmitting(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="card grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
        <div>
          <CustomerCombobox
            customers={customerOptions.map((c) => ({ id: c.id, name: c.displayName }))}
            value={customerId}
            onChange={setCustomerId}
            onCreated={(c) => setCustomerOptions((prev) => [...prev, { id: c.id, displayName: c.name }])}
          />
        </div>
        <div>
          <label className="label">Expiry Date</label>
          <input type="date" className="input" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
        </div>
      </div>

      <div className="card p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink-900">Line Items</h2>
          <button className="btn-secondary" type="button" onClick={addLine}>
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
              <th className="w-32 py-2">Tax</th>
              <th className="w-28 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, idx) => (
              <tr key={line.key} className="border-t border-slate-100">
                <td className="py-2 pr-2">
                  <ItemCombobox
                    items={shopItems}
                    value={line.shopItemId}
                    onSelect={(item) => selectShopItem(idx, line.key, item.id)}
                    onClear={() => updateLine(line.key, { shopItemId: null })}
                  />
                </td>
                <td className="py-2 pr-2">
                  <input
                    className="input"
                    value={line.description}
                    onChange={(e) => updateLine(line.key, { description: e.target.value })}
                  />
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
                <td className="py-2 pr-2">
                  <select
                    className="input"
                    value={line.taxRateId ?? ''}
                    onChange={(e) => updateLine(line.key, { taxRateId: e.target.value || null })}
                  >
                    <option value="">No tax</option>
                    {taxRates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-2 text-right font-medium">{totals.lines[idx]?.lineTotal.toFixed(2)}</td>
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
            <div className="flex justify-between text-slate-600">
              <span>Tax</span>
              <span>{totals.taxTotal.toFixed(2)} {currency}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-1 text-base font-semibold">
              <span>Total</span>
              <span>{totals.total.toFixed(2)} {currency}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <label className="label">Notes</label>
        <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center justify-end gap-4">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300"
            checked={printAfterSave}
            onChange={(e) => setPrintAfterSave(e.target.checked)}
          />
          Print after saving
        </label>
        <div className="flex gap-2">
          <button className="btn-secondary" disabled={!!submitting} onClick={() => submit('save')}>
            {submitting === 'save' ? 'Saving…' : 'Save'}
          </button>
          <button className="btn-primary" disabled={!!submitting} onClick={() => submit('print')}>
            {submitting === 'print' ? 'Saving…' : 'Save & Print'}
          </button>
        </div>
      </div>
    </div>
  );
}
