'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type QuickAddField = {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'select' | 'textarea' | 'date' | 'checkbox';
  options?: { value: string; label: string }[];
  required?: boolean;
  defaultValue?: any;
  step?: string;
};

/**
 * A generic "+ New X" button that opens a small modal form and POSTs to an
 * API route. Used across the simpler admin/CRM/list-style pages (Suppliers,
 * Leads, Opportunities, Employees, Chart of Accounts, etc.) so we don't
 * duplicate near-identical modal forms everywhere.
 */
export default function QuickAddButton({
  label,
  title,
  apiUrl,
  fields,
  buttonClassName = 'btn-primary',
  transformPayload,
}: {
  label: string;
  title: string;
  apiUrl: string;
  fields: QuickAddField[];
  buttonClassName?: string;
  transformPayload?: (values: Record<string, any>) => Record<string, any>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const initial = Object.fromEntries(
    fields.map((f) => [f.key, f.defaultValue ?? (f.type === 'checkbox' ? false : f.type === 'number' ? 0 : '')])
  );
  const [values, setValues] = useState<Record<string, any>>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function set(k: string, v: any) {
    setValues((p) => ({ ...p, [k]: v }));
  }

  async function submit() {
    setSubmitting(true);
    setError('');
    try {
      // Empty-string values (an unselected optional dropdown, a blank text
      // field) are sent as undefined rather than "" so optional foreign-key
      // fields like customerId/leadId don't get set to an empty string.
      const cleaned = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v === '' ? undefined : v]));
      const payload = transformPayload ? transformPayload(cleaned) : cleaned;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ? JSON.stringify(body.error) : 'Failed to save');
      }
      setOpen(false);
      setValues(initial);
      router.refresh();
    } catch (e: any) {
      setError(e.message ?? 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button className={buttonClassName} onClick={() => setOpen(true)}>
        {label}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-md space-y-3 overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-ink-900">{title}</h2>
        {fields.map((f) => (
          <div key={f.key}>
            {f.type !== 'checkbox' && (
              <label className="label">
                {f.label}
                {f.required && ' *'}
              </label>
            )}
            {f.type === 'select' ? (
              <select className="input" value={values[f.key]} onChange={(e) => set(f.key, e.target.value)}>
                {f.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : f.type === 'textarea' ? (
              <textarea
                className="input"
                rows={3}
                value={values[f.key]}
                onChange={(e) => set(f.key, e.target.value)}
              />
            ) : f.type === 'checkbox' ? (
              <label className="flex items-center gap-2 text-sm text-ink-900">
                <input type="checkbox" checked={!!values[f.key]} onChange={(e) => set(f.key, e.target.checked)} />
                {f.label}
              </label>
            ) : (
              <input
                type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                step={f.step}
                className="input"
                value={values[f.key]}
                onChange={(e) => set(f.key, f.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
              />
            )}
          </div>
        ))}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button className="btn-secondary" onClick={() => setOpen(false)}>
            Cancel
          </button>
          <button className="btn-primary" disabled={submitting} onClick={submit}>
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
