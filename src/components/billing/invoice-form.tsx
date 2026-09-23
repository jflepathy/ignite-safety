'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { computeDocumentTotals } from '@/lib/money';
import CustomerCombobox from '@/components/shared/customer-combobox';
import ItemCombobox from '@/components/shared/item-combobox';
import { useBarcodeScanner } from '@/lib/use-barcode-scanner';

type Customer = { id: string; displayName: string; terms?: string | null };
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

export type InvoiceFormInitial = {
  customerId: string;
  dueDate: string;
  poNumber?: string;
  globalDiscountPercent: number;
  terms: string;
  notes: string;
  customerMessage: string;
  taxInclusive: boolean;
  paymentOptions: { card: boolean; bankTransfer: boolean; cash: boolean };
  lines: Line[];
  /** The invoice's actual issue date, used only to recompute the due date if
   * the user changes the Terms preset while editing. Omit on create (today
   * is used instead). */
  issueDateForDueCalc?: string;
};

export default function InvoiceForm({
  customers,
  shopItems,
  taxRates,
  currency,
  defaultCustomerId,
  defaultTerms,
  workOrderId,
  mode = 'create',
  invoiceId,
  initial,
  initialLines,
}: {
  customers: Customer[];
  shopItems: ShopItem[];
  taxRates: TaxRate[];
  currency: string;
  defaultCustomerId?: string;
  defaultTerms?: string;
  workOrderId?: string;
  /** 'edit' loads from `initial` and PATCHes `invoiceId` instead of POSTing a new invoice. */
  mode?: 'create' | 'edit';
  invoiceId?: string;
  initial?: InvoiceFormInitial;
  /** Create-mode only: lines auto-populated from a Work Order's serviceLines
   * (Session 16) — a starting point the user reviews/edits before saving,
   * not sent through `initial` since that's an 'edit'-mode-shaped prop. */
  initialLines?: { shopItemId: string | null; description: string; quantity: number; unitPrice: number }[];
}) {
  const router = useRouter();
  const defaultTaxRate = taxRates.find((t) => t.isDefault) ?? taxRates[0];

  const [customerOptions, setCustomerOptions] = useState(customers);
  const [customerId, setCustomerId] = useState(initial?.customerId ?? defaultCustomerId ?? customers[0]?.id ?? '');
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? '');
  const [poNumber, setPoNumber] = useState(initial?.poNumber ?? '');
  const [globalDiscountPercent, setGlobalDiscountPercent] = useState(initial?.globalDiscountPercent ?? 0);
  const initialTerms = initial?.terms ?? defaultTerms ?? 'Due on Receipt';
  const [termsPreset, setTermsPreset] = useState(TERMS_PRESETS.includes(initialTerms) ? initialTerms : 'Custom');
  const [terms, setTerms] = useState(initialTerms);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [customerMessage, setCustomerMessage] = useState(initial?.customerMessage ?? 'Thank you for your business!');
  const [taxInclusive, setTaxInclusive] = useState(initial?.taxInclusive ?? false);
  const [paymentOptions, setPaymentOptions] = useState(initial?.paymentOptions ?? { card: true, bankTransfer: true, cash: true });
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState('MONTHLY');
  const [status, setStatus] = useState<'DRAFT' | 'SENT'>('DRAFT');
  const [lines, setLines] = useState<Line[]>(
    initial?.lines?.length
      ? initial.lines
      : initialLines?.length
      ? initialLines.map((l) => ({
          key: Math.random().toString(36).slice(2),
          shopItemId: l.shopItemId,
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discountPercent: 0,
          taxRateId: defaultTaxRate?.id ?? null,
        }))
      : [emptyLine()]
  );
  const [printAfterSave, setPrintAfterSave] = useState(true);
  const [submitting, setSubmitting] = useState<'DRAFT' | 'SENT' | 'EDIT' | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Net 15 / Net 30 / Net 60 auto-calculate the due date from the issue
  // date (today, for a new invoice); "Due on Receipt" clears it back to
  // today; "Custom" leaves whatever due date is already set alone.
  const NET_TERMS_DAYS: Record<string, number> = { 'Net 15': 15, 'Net 30': 30, 'Net 60': 60 };
  function selectTermsPreset(preset: string) {
    setTermsPreset(preset);
    if (preset === 'Custom') return;
    setTerms(preset);
    const base = initial?.issueDateForDueCalc ? new Date(initial.issueDateForDueCalc) : new Date();
    if (preset in NET_TERMS_DAYS) {
      const due = new Date(base);
      due.setDate(due.getDate() + NET_TERMS_DAYS[preset]);
      setDueDate(due.toISOString().slice(0, 10));
    } else if (preset === 'Due on Receipt') {
      setDueDate(base.toISOString().slice(0, 10));
    }
  }

  // Terms default from the selected customer's own saved Terms when they
  // have one (Customer > Edit > "Default Invoice Terms"), falling back to
  // the company-wide default (Admin > Company Profile) and then "Due on
  // Receipt" otherwise. Re-applies whenever the customer changes on a
  // brand-new invoice -- switching customer resets Terms/due date to that
  // customer's usual arrangement, same as QuickBooks does, rather than
  // silently leaving the previous customer's terms in place. Never touches
  // an invoice that's already being edited.
  useEffect(() => {
    if (mode !== 'create') return;
    const c = customerOptions.find((opt) => opt.id === customerId);
    const preferred = (c?.terms && c.terms.trim()) || defaultTerms || 'Due on Receipt';
    selectTermsPreset(TERMS_PRESETS.includes(preferred) ? preferred : 'Custom');
    if (!TERMS_PRESETS.includes(preferred)) setTerms(preferred);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

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

  // Selecting an item on the last line opens a fresh blank line beneath it,
  // so staff can keep picking items down the sheet without reaching for
  // "+ Add line" every time.
  function selectShopItem(idx: number, key: string, shopItemId: string) {
    applyShopItem(key, shopItemId);
    if (idx === lines.length - 1) addLine();
  }

  // Barcode scanner support (Session 20) -- registers a scanned item no
  // matter which field currently has focus (the Item combobox doesn't need
  // to be open first). A scan of an item already on the invoice bumps its
  // quantity by one instead of adding a duplicate line; a fresh item fills
  // the first empty line, or is appended if there isn't one.
  const [scanFeedback, setScanFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const scanFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleScan(code: string) {
    const item = shopItems.find((s) => s.sku.toLowerCase() === code.trim().toLowerCase());
    if (!item) {
      showScanFeedback(false, `No item found for scanned code "${code}"`);
      return;
    }
    setLines((prev) => {
      const existingIdx = prev.findIndex((l) => l.shopItemId === item.id);
      if (existingIdx !== -1) {
        return prev.map((l, i) => (i === existingIdx ? { ...l, quantity: l.quantity + 1 } : l));
      }
      const filled: Line = {
        key: Math.random().toString(36).slice(2),
        shopItemId: item.id,
        description: item.name,
        quantity: 1,
        unitPrice: parseFloat(item.unitPrice),
        discountPercent: 0,
        taxRateId: item.taxable ? defaultTaxRate?.id ?? null : null,
      };
      const blankIdx = prev.findIndex(isBlankLine);
      if (blankIdx !== -1) {
        const next = [...prev];
        next[blankIdx] = filled;
        return next;
      }
      return [...prev, filled];
    });
    showScanFeedback(true, `Added ${item.sku} — ${item.name}`);
  }

  function showScanFeedback(ok: boolean, message: string) {
    setScanFeedback({ ok, message });
    if (scanFeedbackTimer.current) clearTimeout(scanFeedbackTimer.current);
    scanFeedbackTimer.current = setTimeout(() => setScanFeedback(null), 2500);
  }

  useBarcodeScanner(handleScan);

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

  // A line the user never touched — no item picked, nothing typed, still at
  // the default qty/price — shouldn't count as a "filled" line just because
  // it exists in the array (the auto-added line beneath a just-picked item
  // is the common case). Drop these before building the save payload so an
  // untouched trailing line never blocks Save with a validation error.
  function isBlankLine(l: Line) {
    return !l.shopItemId && l.description.trim() === '';
  }

  async function handleSubmit(asStatus: 'DRAFT' | 'SENT' | 'EDIT') {
    setSubmitting(asStatus);
    setErrorMsg('');
    try {
      const filledLines = lines.filter((l) => !isBlankLine(l));
      if (filledLines.length === 0) {
        throw new Error('Add at least one line item before saving.');
      }
      const lineItems = filledLines.map((l) => ({
        shopItemId: l.shopItemId,
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discountPercent: l.discountPercent,
        taxRateId: l.taxRateId,
        taxRatePercent: l.taxRateId
          ? parseFloat(taxRates.find((t) => t.id === l.taxRateId)?.ratePercent ?? '0')
          : 0,
      }));

      const isEdit = mode === 'edit';
      const res = await fetch(isEdit ? `/api/invoices/${invoiceId}` : '/api/invoices', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isEdit
            ? {
                customerId,
                dueDate: dueDate || null,
                poNumber: poNumber || null,
                globalDiscountPercent,
                terms,
                notes,
                customerMessage,
                taxInclusive,
                customerPaymentOptions: paymentOptions,
                lineItems,
              }
            : {
                customerId,
                workOrderId: workOrderId ?? null,
                dueDate: dueDate || undefined,
                poNumber: poNumber || undefined,
                globalDiscountPercent,
                terms,
                notes,
                customerMessage,
                taxInclusive,
                customerPaymentOptions: paymentOptions,
                isRecurring,
                recurringFrequency: isRecurring ? recurringFrequency : undefined,
                status: asStatus,
                lineItems,
              }
        ),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ? JSON.stringify(body.error) : `Failed to ${isEdit ? 'save' : 'create'} invoice`);
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
          <CustomerCombobox
            customers={customerOptions.map((c) => ({ id: c.id, name: c.displayName }))}
            value={customerId}
            onChange={setCustomerId}
            onCreated={(c) => setCustomerOptions((prev) => [...prev, { id: c.id, displayName: c.name }])}
          />
        </div>
        <div>
          <label className="label">Due Date</label>
          <input type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div>
          <label className="label">PO Number</label>
          <input
            className="input"
            placeholder="Customer's purchase order number"
            value={poNumber}
            onChange={(e) => setPoNumber(e.target.value)}
          />
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
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-ink-900">Line Items</h2>
            <span className="text-xs text-slate-400">Scan a barcode anytime to add an item</span>
          </div>
          <button className="btn-secondary" onClick={addLine} type="button">
            + Add line
          </button>
        </div>
        {scanFeedback && (
          <p className={`mb-2 text-xs font-medium ${scanFeedback.ok ? 'text-emerald-600' : 'text-red-600'}`}>
            {scanFeedback.ok ? '✓' : '✗'} {scanFeedback.message}
          </p>
        )}
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
                    <ItemCombobox
                      items={shopItems}
                      value={line.shopItemId}
                      onSelect={(item) => selectShopItem(idx, line.key, item.id)}
                      onClear={() => updateLine(line.key, { shopItemId: null })}
                    />
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
          {mode === 'edit' ? (
            <button
              type="button"
              className="btn-primary"
              disabled={!!submitting}
              onClick={() => handleSubmit('EDIT')}
            >
              {submitting === 'EDIT' ? 'Saving…' : 'Save Changes'}
            </button>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
