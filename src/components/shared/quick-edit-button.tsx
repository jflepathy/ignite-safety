'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { QuickAddField } from './quick-add-button';

/**
 * The edit-mode counterpart to QuickAddButton: same field-driven modal form,
 * but pre-filled from an existing record and PATCHes it instead of POSTing a
 * new one. Renders as a small "Edit" link/button — drop it into any list row.
 */
export default function QuickEditButton({
  title,
  apiUrl,
  fields,
  initialValues,
  label = 'Edit',
  buttonClassName = 'text-xs font-medium text-brand-600 hover:underline',
  onSaved,
}: {
  title: string;
  apiUrl: string;
  fields: QuickAddField[];
  initialValues: Record<string, any>;
  label?: string;
  buttonClassName?: string;
  /** Optional: called with the API's JSON response after a successful save,
   * so the caller can update its own local list state instead of relying
   * solely on router.refresh() (which still also runs). */
  onSaved?: (updated: any) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const initial = Object.fromEntries(
    fields.map((f) => [f.key, initialValues[f.key] ?? f.defaultValue ?? (f.type === 'checkbox' ? false : f.type === 'number' ? 0 : '')])
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
      // Password-type fields are "leave unchanged if blank" — omit rather
      // than send null/empty, since the API treats an absent password as
      // "don't reset it" and would otherwise fail validation on null.
      const passwordKeys = new Set(fields.filter((f) => f.type === 'password').map((f) => f.key));
      const cleaned = Object.fromEntries(
        Object.entries(values)
          .filter(([k, v]) => !(passwordKeys.has(k) && !v))
          .map(([k, v]) => [k, v === '' ? null : v])
      );
      const res = await fetch(apiUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleaned),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ? JSON.stringify(body.error) : 'Failed to save');
      }
      const updated = await res.json().catch(() => null);
      if (updated && onSaved) onSaved(updated);
      setOpen(false);
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
              <select className="input" value={values[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)}>
                {f.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : f.type === 'textarea' ? (
              <textarea className="input" rows={3} value={values[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)} />
            ) : f.type === 'checkbox' ? (
              <label className="flex items-center gap-2 text-sm text-ink-900">
                <input type="checkbox" checked={!!values[f.key]} onChange={(e) => set(f.key, e.target.checked)} />
                {f.label}
              </label>
            ) : (
              <input
                type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : f.type === 'password' ? 'password' : 'text'}
                step={f.step}
                autoComplete={f.type === 'password' ? 'new-password' : undefined}
                placeholder={f.type === 'password' ? 'Leave blank to keep current password' : undefined}
                className="input"
                value={values[f.key] ?? ''}
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
