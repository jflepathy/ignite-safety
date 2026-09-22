'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { REGION_OPTIONS, DISTRICTS_BY_REGION } from '@/components/customers/customers-table';

export default function NewCustomerButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ displayName: '', phone: '', email: '', region: '', district: '', address: '' });
  const [submitting, setSubmitting] = useState(false);
  const districtOptions = form.region ? DISTRICTS_BY_REGION[form.region] ?? [] : Object.values(DISTRICTS_BY_REGION).flat();

  async function submit() {
    setSubmitting(true);
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setOpen(false);
        setForm({ displayName: '', phone: '', email: '', region: '', district: '', address: '' });
        router.refresh();
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button className="btn-primary" onClick={() => setOpen(true)}>
        + New Customer
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md space-y-3 rounded-xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold">New Customer</h2>
        <div>
          <label className="label">Name</label>
          <input className="input" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
        </div>
        <div>
          <label className="label">Phone</label>
          <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <label className="label">Region</label>
          <select
            className="input"
            value={form.region}
            onChange={(e) => setForm({ ...form, region: e.target.value, district: '' })}
          >
            <option value="">— Select —</option>
            {REGION_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">District</label>
          <select className="input" value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })}>
            <option value="">— Select —</option>
            {districtOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Address</label>
          <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button className="btn-secondary" onClick={() => setOpen(false)}>
            Cancel
          </button>
          <button className="btn-primary" disabled={submitting || !form.displayName} onClick={submit}>
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
