'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Keys here match NAV_GROUPS[].key in src/lib/nav-config.ts — sidebar-nav.tsx
// hides a whole sidebar group when its key is set to false here. Outreach
// and Work Orders are pinned at the top of the sidebar for every role and
// are not toggleable, since they're the core Ignite-specific workflow.
const MODULES: { key: string; label: string; description: string }[] = [
  { key: 'accounting', label: 'Accounting', description: 'Chart of accounts, reconcile, journal entries, audit log' },
  { key: 'expenses', label: 'Expenses & Pay Bills', description: 'Expense transactions, suppliers, bills, purchase orders' },
  { key: 'billing', label: 'Sales & Get Paid', description: 'Invoices, sales orders, estimates, customers, products' },
  { key: 'customerHub', label: 'Customer Hub', description: 'Customers, leads and opportunities' },
  { key: 'team', label: 'Team', description: 'Employees and time tracking' },
  { key: 'inventory', label: 'Inventory', description: 'Stock levels and inventory adjustments' },
  { key: 'tax', label: 'Tax', description: 'Tax center and tax rates' },
  { key: 'marketing', label: 'Marketing', description: 'Digital & email marketing tools' },
  { key: 'settings', label: 'Settings', description: 'This admin settings section (Admin-only regardless of this toggle)' },
];

export default function UiModulesForm({
  settings,
}: {
  settings: { uiModules: Record<string, boolean> };
}) {
  const router = useRouter();
  const [modules, setModules] = useState<Record<string, boolean>>(settings.uiModules ?? {});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uiModules: modules }),
    });
    setSaving(false);
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="card space-y-4 p-6">
      <h2 className="text-sm font-semibold text-ink-900">UI Customization Controls</h2>
      <p className="text-sm text-slate-500">Toggle visibility of sidebar modules for Sales &amp; Admin users. Takes effect immediately.</p>
      <div className="divide-y divide-slate-100">
        {MODULES.map((m) => (
          <div key={m.key} className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium text-ink-900">{m.label}</p>
              <p className="text-xs text-slate-500">{m.description}</p>
            </div>
            <button
              type="button"
              onClick={() => setModules((prev) => ({ ...prev, [m.key]: !(prev[m.key] ?? true) }))}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                modules[m.key] !== false ? 'bg-brand-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  modules[m.key] !== false ? 'translate-x-5' : 'translate-x-0.5'
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
