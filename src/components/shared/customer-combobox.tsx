'use client';

import { useEffect, useRef, useState } from 'react';

export type CustomerOption = { id: string; name: string };

/**
 * A type-to-filter customer picker with an inline "+ Add new customer" flow,
 * used on the Invoice, Sales Receipt and Estimate forms so staff never have
 * to leave the sale to create a first-time customer, and don't have to
 * scroll a 290+ row dropdown to find one (Session 10).
 */
export default function CustomerCombobox({
  customers,
  value,
  onChange,
  onCreated,
  label = 'Customer',
}: {
  customers: CustomerOption[];
  value: string;
  onChange: (id: string) => void;
  onCreated?: (customer: CustomerOption) => void;
  label?: string;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = customers.find((c) => c.id === value);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const filtered = query.trim()
    ? customers.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()))
    : customers;

  async function submitNewCustomer() {
    if (!newName.trim()) {
      setError('Name is required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: newName.trim(),
          phone: newPhone.trim() || undefined,
          email: newEmail.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ? JSON.stringify(body.error) : 'Failed to create customer');
      }
      const created = await res.json();
      onChange(created.id);
      onCreated?.({ id: created.id, name: created.displayName });
      setCreating(false);
      setOpen(false);
      setNewName('');
      setNewPhone('');
      setNewEmail('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <label className="label">{label}</label>
      <button
        type="button"
        className="input flex items-center justify-between text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <span className={selected ? '' : 'text-slate-400'}>{selected?.name ?? 'Select customer…'}</span>
        <span className="text-slate-400">▾</span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full min-w-[16rem] rounded-lg border border-slate-200 bg-white shadow-lg">
          {!creating ? (
            <>
              <div className="border-b border-slate-100 p-2">
                <input
                  autoFocus
                  className="input"
                  placeholder="Type a name to filter…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div className="max-h-64 overflow-y-auto py-1">
                {filtered.length === 0 && <p className="px-3 py-2 text-sm text-slate-400">No matches.</p>}
                {filtered.slice(0, 150).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 ${
                      c.id === value ? 'bg-brand-50 font-medium text-brand-700' : ''
                    }`}
                    onClick={() => {
                      onChange(c.id);
                      setOpen(false);
                      setQuery('');
                    }}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="block w-full border-t border-slate-100 px-3 py-2 text-left text-sm font-medium text-brand-600 hover:bg-slate-50"
                onClick={() => {
                  setCreating(true);
                  setNewName(query);
                }}
              >
                + Add new customer
              </button>
            </>
          ) : (
            <div className="space-y-2 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">New Customer</p>
              <input className="input" placeholder="Name *" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <input className="input" placeholder="Phone (optional)" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
              <input className="input" placeholder="Email (optional)" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
              {error && <p className="text-xs text-red-600">{error}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  onClick={() => {
                    setCreating(false);
                    setError('');
                  }}
                >
                  Cancel
                </button>
                <button type="button" className="btn-primary text-xs" disabled={saving} onClick={submitNewCustomer}>
                  {saving ? 'Saving…' : 'Create & Select'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
