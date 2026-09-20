'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { computeDocumentTotals } from '@/lib/money';

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

const TERMS_PRESETS = ['Due on Receipt', 'Net 15', 'Net 30', 'Net 60', 'Custom'];
const FREQUENCIES = [
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'ANNUALLY', label: 'Annually' },
];

export default function InvoiceForm({
  customers,
  shopItems,
  taxRates,
  currency,
  defaultCustomerId,
  defaultTerms,
  workOrderId,
}: {
  customers: Customer[];
  shopItems: ShopItem[];
  taxRates: TaxRate[];
  currency: string;
  defaultCustomerId?: string;
  defaultTerms?: string;
  workOrderId?: string;
}) {
  const router = useRouter();
  const defaultTaxRate = taxRates.find((t) => t.isDefault) ?? taxRates[0];

  const [customerId, setCustomerId] = useState(defaultCustomerId ?? customers[0]?.id ?? '');
  const [dueDate, setDueDate] = useState('');
  const [globalDiscountPercent, setGlobalDiscountPercent] = useState(0);
  const [termsPreset, setTermsPreset] = useState(defaultTerms && !TERMS_PRESETS.includes(defaultTerms) ? 'Custom' : defaultTerms || 'Due on Receipt');
  const [terms, setTerms] = useState(defaultTerms ?? 'Due on Receipt');
  const [notes, setNotes] = useState('');
  const [customerMessage, setCustomerMessage] = useState('Thank you for your business!');
  const [taxInclusive, setTaxInclusive] = useState(false);
  const [paymentOptions, setPaymentOptions] = useState({ card: true, bankTransfer: true, cash: true });
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState('MONTHLY');
  const [status, setStatus] = useState<'DRAFT' | 'SENT'>('DRAFT');
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [printAfterSave, setPrintAfterSave] = useState(false);
  const [submitting, setSubmitting] = useState<'DRAFT' | 'SENT' | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  function selectTermsPreset(preset: string) {
    setTermsPreset(preset);
    if (preset !== 'Custom') setTerms(preset);
  }

  function updateLine(key: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(key: string) {
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));
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

  const totals = useMemo(() => {
    return computeDocumentTotals(
      lines.map((l) => ({
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discountPercent: l.discountPercent,
        taxRatePercent: l.taxRateId
          ? parseFloat(taxRates.find((t) => t.id === l.taxRateId)?.ratePercent ?? '0')
          : 0,
      })),
      globalDiscountPercent,
      taxInclusive
    );
  }, [lines, globalDiscountPercent, taxRates, taxInclusive]);

  async function handleSubmit(asStatus: 'DRAFT' | 'SENT') {
    setSubmitting(asStatus);
    setErrorMsg('');
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          workOrderId: workOrderId ?? null,
          dueDate: dueDate || undefined,
          globalDiscountPercent,
          terms,
          notes,
          customerMessage,
          taxInclusive,
          customerPaymentOptions: paymentOptions,
          isRecurring,
          recurringFrequency: isRecurring ? recurringFrequency : undefined,
          status: asStatus,
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
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ? JSON.stringify(body.error) : 'Failed to create invoice');
      }
      const invoice = await res.json();
      router.push(`/billing/invoices/${invoice.id}${printAfterSave ? '?print=1' : ''}`);
      router.refresh();
    } catch (e: any) {
      setErrorMsg(e.message ?? 'Something went wrong');
      setSubmitting(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="card grid grid-cols-1 gap-4 p-6 sm:grid-cols-3">
        <div>
          <label className="label">Customer</label>
          <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.displayName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Due Date</label>
          <input type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div>
          <label className="label">Global Discount (%)</label>
          <input
            type="number"
            min={0}
            max={100}
            className="input"
            value={globalDiscountPercent}
            onChange={(e) => setGlobalDiscountPercent(parseFloat(e.target.value) || 0)}
          />
        </div>
        <div>
          <label className="label">Tax Mode</label>
          <div className="flex overflow-hidden rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setTaxInclusive(false)}
              className={`flex-1 px-3 py-2 text-sm ${!taxInclusive ? 'bg-brand-600 text-white' : 'bg-white text-slate-600'}`}
            >
              Exclusive
            </button>
            <button
              type="button"
              onClick={() => setTaxInclusive(true)}
              className={`flex-1 px-3 py-2 text-sm ${taxInclusive ? 'bg-brand-600 text-white' : 'bg-white text-slate-600'}`}
            >
              Inclusive
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {taxInclusive ? 'Tax is baked into the unit price you enter.' : 'Tax is added on top of the unit price.'}
          </p>
        </div>
        <div>
          <label className="label">Terms</label>
          <select className="input" value={termsPreset} onChange={(e) => selectTermsPreset(e.target.value)}>
            {TERMS_PRESETS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="card p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink-900">Line Items</h2>
          <button className="btn-secondary" onClick={addLine} type="button">
            + Add line
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-500">
                <th className="w-56 py-2">Item</th>
                <th className="w-24 py-2">SKU</th>
                <th className="py-2">Description</th>
                <th className="w-20 py-2 text-right">Qty</th>
                <th className="w-28 py-2 text-right">Unit Price</th>
                <th className="w-24 py-2 text-right">Disc %</th>
                <th className="w-32 py-2">Tax</th>
                <th className="w-28 py-2 text-right">Line Total</th>
                <th className="w-8 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => (
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
                  <td className="py-2 pr-2 text-xs font-mono text-slate-500">
                    {shopItems.find((s) => s.id === line.shopItemId)?.sku ?? '—'}
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      className="input"
                      value={line.description}
                      onChange={(e) => updateLine(line.key, { description: e.target.value })}
                      placeholder="Description"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      min={0}
                      className="input text-right"
                      value={line.quantity}
                      onChange={(e) => updateLine(line.key, { quantity: parseFloat(e.target.value) || 0 })}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className="input text-right"
                      value={line.unitPrice}
                      onChange={(e) => updateLine(line.key, { unitPrice: parseFloat(e.target.value) || 0 })}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      className="input text-right"
                      value={line.discountPercent}
                      onChange={(e) => updateLine(line.key, { discountPercent: parseFloat(e.target.value) || 0 })}
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
                  <td className="py-2 text-right font-medium">
                    {totals.lines[idx]?.lineTotal.toFixed(2)}
                  </td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      onClick={() => removeLine(line.key)}
                      className="text-slate-400 hover:text-red-600"
                      aria-label="Remove line"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex justify-end">
          <div className="w-72 space-y-1 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span>
                {totals.subtotal.toFixed(2)} {currency}
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Discount</span>
              <span>
                -{totals.discountTotal.toFixed(2)} {currency}
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Tax</span>
              <span>
                {totals.taxTotal.toFixed(2)} {currency}
              </span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-1 text-base font-semibold text-ink-900">
              <span>Total</span>
              <span>
                {totals.total.toFixed(2)} {currency}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="card grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
        <div>
          <label className="label">Terms (full text shown on invoice)</label>
          <textarea className="input" rows={3} value={terms} onChange={(e) => setTerms(e.target.value)} />
        </div>
        <div>
          <label className="label">Message to Customer</label>
          <textarea
            className="input"
            rows={3}
            value={customerMessage}
            onChange={(e) => setCustomerMessage(e.target.value)}
            placeholder="Shown on the invoice, above the line items."
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Notes (internal only — never shown to the customer)</label>
          <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>

      <div className="card grid grid-cols-1 gap-6 p-6 sm:grid-cols-2">
        <div>
          <label className="label">Customer Payment Options</label>
          <div className="space-y-2 text-sm text-ink-900">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={paymentOptions.card}
                onChange={(e) => setPaymentOptions((p) => ({ ...p, card: e.target.checked }))}
              />
              Card
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={paymentOptions.bankTransfer}
                onChange={(e) => setPaymentOptions((p) => ({ ...p, bankTransfer: e.target.checked }))}
              />
              Bank Transfer
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={paymentOptions.cash}
                onChange={(e) => setPaymentOptions((p) => ({ ...p, cash: e.target.checked }))}
              />
              Cash
            </label>
          </div>
        </div>
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-ink-900">
            <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} />
            Make this a recurring invoice
          </label>
          {isRecurring && (
            <div className="mt-2">
              <label className="label">Frequency</label>
              <select className="input" value={recurringFrequency} onChange={(e) => setRecurringFrequency(e.target.value)}>
                {FREQUENCIES.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-400">
                Saves a recurring template you can review in Lists &amp; Tools. Automatic regeneration on schedule is coming soon.
              </p>
            </div>
          )}
          <p className="mt-3 text-xs text-slate-400">
            A direct share link, attachments and the printable PDF view become available once the invoice is saved.
          </p>
        </div>
      </div>

      {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}

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
        <div className="flex gap-3">
          <button
            type="button"
            className="btn-secondary"
            disabled={!!submitting}
            onClick={() => handleSubmit('DRAFT')}
          >
            {submitting === 'DRAFT' ? 'Saving…' : 'Save as Draft'}
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={!!submitting}
            onClick={() => handleSubmit('SENT')}
          >
            {submitting === 'SENT' ? 'Saving…' : 'Save & Mark as Sent'}
          </button>
        </div>
      </div>
    </div>
  );
}
