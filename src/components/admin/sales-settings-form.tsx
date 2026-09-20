'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Settings = {
  preferredPaymentTerms: string;
  deliveryMethod: string;
  customFieldsEnabled: boolean;
  transactionNumberingEnabled: boolean;
  serviceDateEnabled: boolean;
  discountsEnabled: boolean;
  depositsOnSalesEnabled: boolean;
  tagsEnabled: boolean;
  skuTrackingEnabled: boolean;
  priceRulesEnabled: boolean;
  inventoryReceivingEnabled: boolean;
  progressInvoicingEnabled: boolean;
};

// Ordered logically in four groups: form/field customization, pricing &
// discounts, inventory & tracking, then invoicing mode — the same
// top-down grouping used in Expenses Settings.
const TOGGLES: { key: keyof Settings; label: string; description: string }[] = [
  // Form & field customization
  { key: 'customFieldsEnabled', label: 'Custom Fields', description: 'Allow custom fields on sales forms.' },
  { key: 'transactionNumberingEnabled', label: 'Custom Transaction Numbers', description: 'Let staff override auto-generated numbers.' },
  { key: 'serviceDateEnabled', label: 'Service Date', description: 'Show a separate service date field on sales forms.' },
  // Pricing & discounts
  { key: 'discountsEnabled', label: 'Discounts', description: 'Allow item and global discounts on sales forms.' },
  { key: 'priceRulesEnabled', label: 'Price Rules', description: 'Enable customer- or quantity-based pricing rules.' },
  { key: 'depositsOnSalesEnabled', label: 'Deposits on Sales', description: 'Collect a deposit before completing a sale.' },
  // Inventory & tracking
  { key: 'skuTrackingEnabled', label: 'SKU Tracking', description: 'Show and require SKUs on products & services.' },
  { key: 'inventoryReceivingEnabled', label: 'Inventory Receiving', description: 'Track quantity received against purchase orders.' },
  { key: 'tagsEnabled', label: 'Tags', description: 'Allow tagging customers and transactions.' },
  // Invoicing mode
  { key: 'progressInvoicingEnabled', label: 'Progress Invoicing', description: 'Invoice a sales order in stages rather than all at once.' },
];

export default function SalesSettingsForm({ settings }: { settings: Settings }) {
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
      <h2 className="text-sm font-semibold text-ink-900">Sales Settings</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Preferred Payment Terms</label>
          <select
            className="input"
            value={form.preferredPaymentTerms}
            onChange={(e) => setForm({ ...form, preferredPaymentTerms: e.target.value })}
          >
            {['Due on receipt', 'Net 15', 'Net 30', 'Net 60'].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Delivery Method</label>
          <select className="input" value={form.deliveryMethod} onChange={(e) => setForm({ ...form, deliveryMethod: e.target.value })}>
            {['Email', 'Print', 'Share Link Only'].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
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
