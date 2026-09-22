'use client';

import { useState } from 'react';
import { formatMoney } from '@/lib/money';

type InventoryItem = {
  id: string;
  sku: string;
  name: string;
  quantityOnHand: number | null;
  reorderPoint: number | null;
  cost: string | null;
  unitPrice: string;
};

export default function InventoryTable({ items, currency }: { items: InventoryItem[]; currency: string }) {
  const [query, setQuery] = useState('');

  const filtered = items.filter((i) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return i.sku.toLowerCase().includes(q) || i.name.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-3">
      <input
        className="input max-w-sm"
        placeholder="Search by SKU or name…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3 text-right">Qty on Hand</th>
              <th className="px-4 py-3 text-right">Reorder Point</th>
              <th className="px-4 py-3 text-right">Unit Cost</th>
              <th className="px-4 py-3 text-right">Unit Price</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((i) => {
              const low = i.reorderPoint != null && (i.quantityOnHand ?? 0) <= (i.reorderPoint ?? 0);
              return (
                <tr key={i.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-500">{i.sku}</td>
                  <td className="px-4 py-3 font-medium text-ink-900">{i.name}</td>
                  <td className={`px-4 py-3 text-right font-medium ${low ? 'text-red-600' : ''}`}>{i.quantityOnHand ?? 0}</td>
                  <td className="px-4 py-3 text-right text-slate-500">{i.reorderPoint ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-500">{i.cost ? formatMoney(i.cost, currency) : '—'}</td>
                  <td className="px-4 py-3 text-right">{formatMoney(i.unitPrice, currency)}</td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  {items.length === 0
                    ? "No items marked as inventory-tracked yet. Set an item's type to Inventory in Products & Services."
                    : 'No items match your search.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
