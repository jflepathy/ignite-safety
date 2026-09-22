'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import QuickEditButton from '@/components/shared/quick-edit-button';

type Item = {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  itemType: 'INVENTORY' | 'NON_INVENTORY' | 'SERVICE' | 'BUNDLE';
  unitPrice: string;
  quantityOnHand: number | null;
  reorderPoint: number | null;
  taxable: boolean;
  active: boolean;
};

const TYPE_LABELS: Record<Item['itemType'], string> = {
  INVENTORY: 'Inventory (tracked)',
  NON_INVENTORY: 'Non-Inventory',
  SERVICE: 'Service (untracked)',
  BUNDLE: 'Bundle',
};

export default function ShopItemsManager({ items, currency, canEdit }: { items: Item[]; currency: string; canEdit: boolean }) {
  const router = useRouter();
  const [list, setList] = useState(items);
  const [form, setForm] = useState({
    sku: '',
    name: '',
    category: '',
    itemType: 'SERVICE' as Item['itemType'],
    unitPrice: 0,
    quantityOnHand: 0,
    reorderPoint: 0,
    taxable: true,
  });
  const [saving, setSaving] = useState(false);
  const [generatingSku, setGeneratingSku] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function generateSku() {
    setGeneratingSku(true);
    try {
      const res = await fetch('/api/shop-items/next-sku', { method: 'POST' });
      if (res.ok) {
        const { sku } = await res.json();
        setForm((f) => ({ ...f, sku }));
      }
    } finally {
      setGeneratingSku(false);
    }
  }

  async function add() {
    if (!form.sku || !form.name) return;
    setSaving(true);
    try {
      const res = await fetch('/api/shop-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          quantityOnHand: form.itemType === 'INVENTORY' ? form.quantityOnHand : undefined,
          reorderPoint: form.itemType === 'INVENTORY' ? form.reorderPoint : undefined,
        }),
      });
      if (res.ok) {
        const item = await res.json();
        setList((prev) => [...prev, { ...item, unitPrice: item.unitPrice.toString() }]);
        setForm({ sku: '', name: '', category: '', itemType: 'SERVICE', unitPrice: 0, quantityOnHand: 0, reorderPoint: 0, taxable: true });
      }
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(id: string, active: boolean) {
    await fetch(`/api/shop-items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    });
    setList((prev) => prev.map((i) => (i.id === id ? { ...i, active } : i)));
    router.refresh();
  }

  function exportCsv() {
    window.open('/api/shop-items/export', '_blank');
  }

  async function importCsv(file: File) {
    setImporting(true);
    setImportMsg('');
    try {
      const text = await file.text();
      const res = await fetch('/api/shop-items/import', {
        method: 'POST',
        headers: { 'Content-Type': 'text/csv' },
        body: text,
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? 'Import failed.');
      setImportMsg(
        `Imported: ${body.created} created, ${body.updated} updated.${body.errors?.length ? ` ${body.errors.length} row(s) skipped.` : ''}`
      );
      router.refresh();
      const res2 = await fetch('/api/shop-items');
      if (res2.ok) {
        const fresh = await res2.json();
        setList(fresh.map((i: any) => ({ ...i, unitPrice: i.unitPrice.toString() })));
      }
    } catch (e: any) {
      setImportMsg(e.message);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="card space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink-900">Products &amp; Services</h2>
        <div className="flex items-center gap-2">
          <button className="btn-secondary" onClick={exportCsv}>
            ⬇ Export CSV
          </button>
          <button className="btn-secondary" disabled={importing} onClick={() => fileRef.current?.click()}>
            {importing ? 'Importing…' : '⬆ Import CSV'}
          </button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])} />
        </div>
      </div>
      {importMsg && <p className="text-sm text-slate-600">{importMsg}</p>}

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase text-slate-500">
            <th className="py-2">SKU</th>
            <th className="py-2">Name</th>
            <th className="py-2">Type</th>
            <th className="py-2">Category</th>
            <th className="py-2 text-right">Unit Price</th>
            <th className="py-2 text-right">Qty on Hand</th>
            <th className="py-2">Taxable</th>
            <th className="py-2">Active</th>
            {canEdit && <th className="py-2"></th>}
          </tr>
        </thead>
        <tbody>
          {list.map((item) => (
            <tr key={item.id} className="border-t border-slate-100">
              <td className="py-2 font-mono text-xs">{item.sku}</td>
              <td className="py-2">{item.name}</td>
              <td className="py-2 text-slate-500">{TYPE_LABELS[item.itemType]}</td>
              <td className="py-2 text-slate-500">{item.category ?? '—'}</td>
              <td className="py-2 text-right">
                {item.unitPrice} {currency}
              </td>
              <td className="py-2 text-right text-slate-500">{item.itemType === 'INVENTORY' ? item.quantityOnHand ?? 0 : '—'}</td>
              <td className="py-2">{item.taxable ? 'Yes' : 'No'}</td>
              <td className="py-2">
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => toggleActive(item.id, !item.active)}
                    className={`badge ${item.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                  >
                    {item.active ? 'Active' : 'Inactive'}
                  </button>
                ) : (
                  <span className={`badge ${item.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {item.active ? 'Active' : 'Inactive'}
                  </span>
                )}
              </td>
              {canEdit && (
                <td className="py-2 text-right">
                  <QuickEditButton
                    title={`Edit ${item.name}`}
                    apiUrl={`/api/shop-items/${item.id}`}
                    initialValues={{
                      name: item.name,
                      category: item.category ?? '',
                      unitPrice: Number(item.unitPrice),
                      taxable: item.taxable,
                      quantityOnHand: item.quantityOnHand ?? 0,
                      reorderPoint: item.reorderPoint ?? 0,
                    }}
                    fields={[
                      { key: 'name', label: 'Name', required: true },
                      { key: 'category', label: 'Category' },
                      { key: 'unitPrice', label: `Unit Price (${currency})`, type: 'number', step: '0.01' },
                      { key: 'taxable', label: 'Taxable', type: 'checkbox' },
                      ...(item.itemType === 'INVENTORY'
                        ? ([
                            { key: 'quantityOnHand', label: 'Qty on Hand', type: 'number' },
                            { key: 'reorderPoint', label: 'Reorder Point', type: 'number' },
                          ] as const)
                        : []),
                    ]}
                    onSaved={(updated) =>
                      setList((prev) => prev.map((x) => (x.id === item.id ? { ...x, ...updated, unitPrice: updated.unitPrice?.toString() ?? x.unitPrice } : x)))
                    }
                  />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {canEdit && (
      <div className="space-y-3 rounded-lg bg-slate-50 p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className="label">SKU / Item Code</label>
            <div className="flex gap-1">
              <input className="input" placeholder="Manual entry" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
              <button type="button" className="btn-secondary shrink-0 px-2 text-xs" disabled={generatingSku} onClick={generateSku}>
                {generatingSku ? '…' : 'Auto'}
              </button>
            </div>
          </div>
          <div>
            <label className="label">Name</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Type</label>
            <select className="input" value={form.itemType} onChange={(e) => setForm({ ...form, itemType: e.target.value as Item['itemType'] })}>
              {Object.entries(TYPE_LABELS).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Category</label>
            <input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </div>
          <div>
            <label className="label">Unit Price</label>
            <input
              type="number"
              step="0.01"
              className="input"
              value={form.unitPrice}
              onChange={(e) => setForm({ ...form, unitPrice: parseFloat(e.target.value) || 0 })}
            />
          </div>
          {form.itemType === 'INVENTORY' && (
            <>
              <div>
                <label className="label">Qty on Hand</label>
                <input
                  type="number"
                  className="input"
                  value={form.quantityOnHand}
                  onChange={(e) => setForm({ ...form, quantityOnHand: parseInt(e.target.value, 10) || 0 })}
                />
              </div>
              <div>
                <label className="label">Reorder Point</label>
                <input
                  type="number"
                  className="input"
                  value={form.reorderPoint}
                  onChange={(e) => setForm({ ...form, reorderPoint: parseInt(e.target.value, 10) || 0 })}
                />
              </div>
            </>
          )}
        </div>
        <button className="btn-primary" disabled={saving} onClick={add}>
          + Add Item
        </button>
      </div>
      )}
    </div>
  );
}
