'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Settings = {
  expenseItemizationEnabled: boolean;
  expenseTaggingEnabled: boolean;
  billableExpenseTrackingEnabled: boolean;
  defaultBillTermsDays: number;
  purchaseOrdersEnabled: boolean;
};

// Ordered logically: workflow-level switches first (which entire
// sub-workflows are enabled), then entry-level behavior for a single
// expense (how each transaction can be itemized/tagged/billed), mirroring
// the same top-down grouping used in Sales Settings.
const TOGGLES: { key: keyof Settings; label: string; description: string }[] = [
  { key: 'purchaseOrdersEnabled', label: 'Purchase Orders', description: 'Enable the Purchase Orders workflow under Expenses.' },
  { key: 'expenseItemizationEnabled', label: 'Itemization', description: 'Allow splitting an expense into multiple line items.' },
  { key: 'billableExpenseTrackingEnabled', label: 'Billable Expenses', description: 'Mark expenses as billable to a customer.' },
  { key: 'expenseTaggingEnabled', label: 'Tags on Expenses', description: 'Allow tagging expenses for reporting.' },
];

export default function ExpensesSettingsForm({ settings }: { settings: Settings }) {
  const router = useRouter();
  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="card space-y-4 p-6">
      <h2 className="text-sm font-semibold text-ink-900">Expenses Settings</h2>
      <div>
        <label className="label">Default Bill Terms (days)</label>
        <input
          type="number"
          className="input w-40"
          value={form.defaultBillTermsDays}
          onChange={(e) => setForm({ ...form, defaultBillTermsDays: parseInt(e.target.value, 10) || 0 })}
        />
      </div>
      <div className="divide-y divide-slate-100">
        {TOGGLES.map((t) => (
          <div key={t.key} className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium text-ink-900">{t.label}</p>
              <p className="text-xs text-slate-500">{t.description}</p>
            </div>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, [t.key]: !f[t.key] }))}
              className={`relative h-6 w-11 rounded-full transition-colors ${form[t.key] ? 'bg-brand-600' : 'bg-slate-300'}`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  form[t.key] ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={saving} onClick={save}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
        {saved && <span className="text-sm text-emerald-600">Saved ✓</span>}
      </div>
    </div>
  );
}
