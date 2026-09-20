'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Item = { id: string; sku: string; name: string; quantityOnHand: number };

const REASONS = ['Stock count correction', 'Shrinkage / damage', 'Received without PO', 'Other'];

export default function InventoryAdjustmentForm({ items }: { items: Item[] }) {
  const router = useRouter();
  const [shopItemId, setShopItemId] = useState(items[0]?.id ?? '');
  const [quantityChange, setQuantityChange] = useState(0);
  const [reason, setReason] = useState(REASONS[0]);
  const [memo, setMemo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const current = items.find((i) => i.id === shopItemId);

  async function submit() {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/inventory-adjustments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopItemId, quantityChange, reason, memo: memo || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ? JSON.stringify(body.error) : 'Failed to save');
      }
      router.push('/inventory/adjustments');
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card grid max-w-xl grid-cols-1 gap-4 p-6">
      <div>
        <label className="label">Item</label>
        <select className="input" value={shopItemId} onChange={(e) => setShopItemId(e.target.value)}>
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.sku} — {i.name} (on hand: {i.quantityOnHand})
            </option>
          ))}
        </select>
      </div>
      {current && <p className="text-xs text-slate-500">Current on hand: {current.quantityOnHand}</p>}
      <div>
        <label className="label">Quantity Change</label>
        <input
          type="number"
          className="input"
          value={quantityChange}
          onChange={(e) => setQuantityChange(parseInt(e.target.value, 10) || 0)}
        />
        <p className="mt-1 text-xs text-slate-400">Positive to add stock, negative to remove.</p>
      </div>
      <div>
        <label className="label">Reason</label>
        <select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
          {REASONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Memo</label>
        <textarea className="input" rows={3} value={memo} onChange={(e) => setMemo(e.target.value)} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end">
        <button className="btn-primary" disabled={submitting || !shopItemId || quantityChange === 0} onClick={submit}>
          {submitting ? 'Saving…' : 'Save Adjustment'}
        </button>
      </div>
    </div>
  );
}
