'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ItemCombobox from '@/components/shared/item-combobox';
import { formatMoney } from '@/lib/money';

type ShopItemOption = { id: string; sku: string; name: string; unitPrice: string };
type Line = { key: string; shopItemId: string | null; description: string; quantity: number; unitPrice: number };

function emptyLine(): Line {
  return { key: Math.random().toString(36).slice(2), shopItemId: null, description: '', quantity: 1, unitPrice: 0 };
}

/** Mobile line-item editor for the technician billing bridge's auto-raised
 * DRAFT invoice (Session 16 follow-up) — a lightweight version of the
 * desktop InvoiceForm's line items table, no customer/tax/discount fields,
 * since a technician is only ever fixing what services were logged. */
export default function TechnicianInvoiceLineEditor({
  invoiceId,
  currency,
  shopItems,
  initialLines,
}: {
  invoiceId: string;
  currency: string;
  shopItems: ShopItemOption[];
  initialLines: Line[];
}) {
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>(initialLines.length > 0 ? initialLines : [emptyLine()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function updateLine(key: string, patch: Partial<Line>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((ls) => [...ls, emptyLine()]);
  }

  function removeLine(key: string) {
    setLines((ls) => (ls.length > 1 ? ls.filter((l) => l.key !== key) : ls));
  }

  function selectShopItem(key: string, item: ShopItemOption) {
    setLines((ls) => {
      const idx = ls.findIndex((l) => l.key === key);
      const next = ls.map((l) =>
        l.key === key ? { ...l, shopItemId: item.id, description: `${item.sku} — ${item.name}`, unitPrice: Number(item.unitPrice) } : l
      );
      // Auto-open a fresh blank line when picking on the last row, same
      // convenience the desktop item picker has (Session 13).
      if (idx === ls.length - 1) next.push(emptyLine());
      return next;
    });
  }

  const total = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);

  async function save() {
    const payload = lines
      .filter((l) => l.description.trim() !== '' || l.shopItemId)
      .map((l) => ({ shopItemId: l.shopItemId, description: l.description, quantity: l.quantity, unitPrice: l.unitPrice }));
    if (payload.length === 0) {
      setError('Add at least one line item.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/technician-edit`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineItems: payload }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.formErrors?.[0] ?? 'Failed to save changes');
      }
      router.push(`/technician/invoice/${invoiceId}`);
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {lines.map((line) => (
          <div key={line.key} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <ItemCombobox
              items={shopItems}
              value={line.shopItemId}
              onSelect={(item) => selectShopItem(line.key, item)}
              onClear={() => updateLine(line.key, { shopItemId: null })}
            />
            {!line.shopItemId && (
              <input
                className="input mt-2"
                placeholder="Description"
                value={line.description}
                onChange={(e) => updateLine(line.key, { description: e.target.value })}
              />
            )}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div>
                <label className="label text-xs">Qty</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="input"
                  value={line.quantity}
                  onChange={(e) => updateLine(line.key, { quantity: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label className="label text-xs">Unit price ({currency})</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="input"
                  value={line.unitPrice}
                  onChange={(e) => updateLine(line.key, { unitPrice: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm font-medium text-ink-900">
                {formatMoney(line.quantity * line.unitPrice, currency)}
              </span>
              {lines.length > 1 && (
                <button type="button" className="text-xs text-red-600" onClick={() => removeLine(line.key)}>
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <button type="button" className="btn-secondary block w-full py-2 text-sm" onClick={addLine}>
        + Add line
      </button>

      <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-base font-semibold text-ink-900">
        <span>Total</span>
        <span>{formatMoney(total, currency)}</span>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button className="btn-primary block w-full py-3 text-base" disabled={saving} onClick={save}>
        {saving ? 'Saving…' : 'Save changes'}
      </button>
    </div>
  );
}
