'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EQUIPMENT_CATEGORIES } from '@/lib/equipment-categories';
import { formatDate } from '@/lib/format-date';

type Row = {
  id: string;
  customerId: string;
  customerName: string;
  category: string;
  serialNumber: string | null;
  make: string | null;
  model: string | null;
  locationDescription: string | null;
  installDate: string | null;
  lastServiceDate: string | null;
  intervalMonths: number;
  status: string;
};
type Cust = { id: string; displayName: string };

const label = (v: string) => EQUIPMENT_CATEGORIES.find((c) => c.value === v)?.label ?? v;

function nextDue(r: Row): Date | null {
  const base = r.lastServiceDate ?? r.installDate;
  if (!base) return null;
  const d = new Date(base);
  d.setUTCMonth(d.getUTCMonth() + (r.intervalMonths || 12));
  return d;
}

const EMPTY = {
  id: '',
  customerId: '',
  category: 'FIRE_EXTINGUISHER',
  serialNumber: '',
  make: '',
  model: '',
  locationDescription: '',
  installDate: '',
  lastServiceDate: '',
  intervalMonths: 12,
  status: 'ACTIVE',
};

export default function EquipmentManager({ rows, customers, isAdmin }: { rows: Row[]; customers: Cust[]; isAdmin: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const today = new Date();

  const visible = useMemo(() => {
    const n = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (!cat || r.category === cat) &&
        (!status || r.status === status) &&
        (!n || `${r.customerName} ${r.serialNumber ?? ''} ${r.make ?? ''} ${r.model ?? ''} ${r.locationDescription ?? ''}`.toLowerCase().includes(n))
    );
  }, [rows, q, cat, status]);

  function openEdit(r: Row) {
    setErr('');
    setForm({
      id: r.id,
      customerId: r.customerId,
      category: r.category,
      serialNumber: r.serialNumber ?? '',
      make: r.make ?? '',
      model: r.model ?? '',
      locationDescription: r.locationDescription ?? '',
      installDate: r.installDate ?? '',
      lastServiceDate: r.lastServiceDate ?? '',
      intervalMonths: r.intervalMonths,
      status: r.status,
    });
  }

  async function save() {
    if (!form) return;
    if (!form.customerId) return setErr('Choose a customer.');
    setBusy(true);
    setErr('');
    try {
      const body: any = {
        customerId: form.customerId,
        category: form.category,
        serialNumber: form.serialNumber,
        make: form.make,
        model: form.model,
        locationDescription: form.locationDescription,
        installDate: form.installDate || null,
        lastServiceDate: form.lastServiceDate || null,
        intervalMonths: Number(form.intervalMonths) || 12,
      };
      let res: Response;
      if (form.id) {
        body.status = form.status;
        res = await fetch(`/api/equipment/${form.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      } else {
        // POST ignores nulls on optional strings, so strip empties
        for (const k of ['serialNumber', 'make', 'model', 'locationDescription']) if (!body[k]) delete body[k];
        if (!body.installDate) delete body.installDate;
        if (!body.lastServiceDate) delete body.lastServiceDate;
        res = await fetch('/api/equipment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      }
      if (!res.ok) throw new Error('Could not save — check the fields.');
      setForm(null);
      router.refresh();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(r: Row) {
    if (!confirm(`Delete this ${label(r.category).replace(/s$/, '')} (${r.serialNumber || 'no serial'}) for ${r.customerName}? It moves to the Recycle Bin.`)) return;
    const res = await fetch(`/api/equipment/${r.id}`, { method: 'DELETE' });
    if (res.ok) router.refresh();
    else alert('Delete failed.');
  }

  const set = (k: keyof typeof EMPTY, v: any) => setForm((f) => (f ? { ...f, [k]: v } : f));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Equipment</h1>
          <p className="text-sm text-slate-500">Every extinguisher, hose reel, blanket and detector on a customer site. {visible.length} shown.</p>
        </div>
        <button className="btn-primary" onClick={() => { setErr(''); setForm({ ...EMPTY }); }}>
          + Add equipment
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <input className="input max-w-xs" placeholder="Search customer, serial, make, location" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input w-auto" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">All types</option>
          {EQUIPMENT_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="ACTIVE">Active</option>
          <option value="DECOMMISSIONED">Decommissioned</option>
          <option value="">Any status</option>
        </select>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Serial / Make</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Last service</th>
              <th className="px-4 py-3">Next due</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const nd = nextDue(r);
              const overdue = nd && nd < today && r.status === 'ACTIVE';
              return (
                <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-ink-900">{r.customerName}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {label(r.category)}
                    {r.status !== 'ACTIVE' && <span className="badge ml-2 bg-slate-200 text-slate-600">Decommissioned</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <div>{r.serialNumber || '—'}</div>
                    <div className="text-xs text-slate-400">{[r.make, r.model].filter(Boolean).join(' ')}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{r.locationDescription || '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(r.lastServiceDate) || '—'}</td>
                  <td className="px-4 py-3">
                    {nd ? (
                      <span className={overdue ? 'font-medium text-red-600' : 'text-slate-600'}>{formatDate(nd)}</span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <button className="btn-secondary mr-2" onClick={() => openEdit(r)}>Edit</button>
                    {isAdmin && (
                      <button className="btn-secondary text-red-600" onClick={() => remove(r)}>Delete</button>
                    )}
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">No equipment matches.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold text-ink-900">{form.id ? 'Edit equipment' : 'Add equipment'}</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="col-span-2 text-sm">
                Customer
                <select className="input mt-1" value={form.customerId} onChange={(e) => set('customerId', e.target.value)}>
                  <option value="">Select…</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.displayName}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                Type
                <select className="input mt-1" value={form.category} onChange={(e) => set('category', e.target.value)}>
                  {EQUIPMENT_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                Serial number
                <input className="input mt-1" value={form.serialNumber} onChange={(e) => set('serialNumber', e.target.value)} />
              </label>
              <label className="text-sm">
                Make
                <input className="input mt-1" value={form.make} onChange={(e) => set('make', e.target.value)} />
              </label>
              <label className="text-sm">
                Model / size
                <input className="input mt-1" value={form.model} onChange={(e) => set('model', e.target.value)} />
              </label>
              <label className="col-span-2 text-sm">
                Location on site
                <input className="input mt-1" value={form.locationDescription} onChange={(e) => set('locationDescription', e.target.value)} />
              </label>
              <label className="text-sm">
                Install date
                <input type="date" className="input mt-1" value={form.installDate} onChange={(e) => set('installDate', e.target.value)} />
              </label>
              <label className="text-sm">
                Last service date
                <input type="date" className="input mt-1" value={form.lastServiceDate} onChange={(e) => set('lastServiceDate', e.target.value)} />
              </label>
              <label className="text-sm">
                Service interval (months)
                <input type="number" min={1} className="input mt-1" value={form.intervalMonths} onChange={(e) => set('intervalMonths', e.target.value)} />
              </label>
              {form.id && (
                <label className="text-sm">
                  Status
                  <select className="input mt-1" value={form.status} onChange={(e) => set('status', e.target.value)}>
                    <option value="ACTIVE">Active</option>
                    <option value="DECOMMISSIONED">Decommissioned</option>
                  </select>
                </label>
              )}
            </div>
            {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setForm(null)}>Cancel</button>
              <button className="btn-primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
