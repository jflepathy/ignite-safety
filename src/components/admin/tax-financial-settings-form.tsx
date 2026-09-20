'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Settings = {
  discountLimitPercent: string | number;
  allowedPaymentMethods: string[];
  invoicePrefix: string;
  estimatePrefix: string;
  creditNotePrefix: string;
  taxInclusivePricing: boolean;
};

type TaxRate = { id: string; name: string; ratePercent: string; isDefault: boolean; active: boolean };

const ALL_METHODS = ['CASH', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'OTHER'];

export default function TaxFinancialSettingsForm({
  settings,
  taxRates,
}: {
  settings: Settings;
  taxRates: TaxRate[];
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    discountLimitPercent: Number(settings.discountLimitPercent),
    allowedPaymentMethods: settings.allowedPaymentMethods,
    invoicePrefix: settings.invoicePrefix,
    estimatePrefix: settings.estimatePrefix,
    creditNotePrefix: settings.creditNotePrefix,
    taxInclusivePricing: settings.taxInclusivePricing,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [newRateName, setNewRateName] = useState('');
  const [newRatePercent, setNewRatePercent] = useState(0);
  const [rates, setRates] = useState(taxRates);

  function toggleMethod(method: string) {
    setForm((f) => ({
      ...f,
      allowedPaymentMethods: f.allowedPaymentMethods.includes(method)
        ? f.allowedPaymentMethods.filter((m) => m !== method)
        : [...f.allowedPaymentMethods, method],
    }));
  }

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

  async function addRate() {
    if (!newRateName) return;
    const res = await fetch('/api/tax-rates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newRateName, ratePercent: newRatePercent, isDefault: rates.length === 0 }),
    });
    if (res.ok) {
      const rate = await res.json();
      setRates((prev) => [...prev, rate]);
      setNewRateName('');
      setNewRatePercent(0);
    }
  }

  return (
    <div className="space-y-6">
      <div className="card space-y-4 p-6">
        <h2 className="text-sm font-semibold text-ink-900">Tax & Financial Settings</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Discount Limit (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              className="input"
              value={form.discountLimitPercent}
              onChange={(e) => setForm({ ...form, discountLimitPercent: parseFloat(e.target.value) || 0 })}
            />
            <p className="mt-1 text-xs text-slate-400">Maximum discount % staff may apply without override.</p>
          </div>
          <div>
            <label className="label">Invoice Prefix</label>
            <input className="input" value={form.invoicePrefix} onChange={(e) => setForm({ ...form, invoicePrefix: e.target.value })} />
          </div>
          <div>
            <label className="label">Estimate Prefix</label>
            <input className="input" value={form.estimatePrefix} onChange={(e) => setForm({ ...form, estimatePrefix: e.target.value })} />
          </div>
          <div>
            <label className="label">Credit Note Prefix</label>
            <input className="input" value={form.creditNotePrefix} onChange={(e) => setForm({ ...form, creditNotePrefix: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="label">Allowed Payment Methods</label>
          <div className="flex flex-wrap gap-2">
            {ALL_METHODS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => toggleMethod(m)}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  form.allowedPaymentMethods.includes(m)
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-slate-200 text-slate-500'
                }`}
              >
                {m.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
          <div>
            <p className="text-sm font-medium text-ink-900">Default Tax-Inclusive Pricing</p>
            <p className="text-xs text-slate-500">New invoices default to tax-inclusive unit prices.</p>
          </div>
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, taxInclusivePricing: !f.taxInclusivePricing }))}
            className={`relative h-6 w-11 rounded-full transition-colors ${form.taxInclusivePricing ? 'bg-brand-600' : 'bg-slate-300'}`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                form.taxInclusivePricing ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-primary" disabled={saving} onClick={save}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          {saved && <span className="text-sm text-emerald-600">Saved ✓</span>}
        </div>
      </div>

      <div className="card space-y-4 p-6">
        <h2 className="text-sm font-semibold text-ink-900">Tax Rates (e.g. SCR VAT)</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-500">
              <th className="py-2">Name</th>
              <th className="py-2 text-right">Rate %</th>
              <th className="py-2">Default</th>
            </tr>
          </thead>
          <tbody>
            {rates.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="py-2">{r.name}</td>
                <td className="py-2 text-right">{r.ratePercent}%</td>
                <td className="py-2">{r.isDefault ? '✓' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="label">New Rate Name</label>
            <input className="input" value={newRateName} onChange={(e) => setNewRateName(e.target.value)} placeholder="SCR VAT 15%" />
          </div>
          <div>
            <label className="label">Rate %</label>
            <input
              type="number"
              step="0.01"
              className="input w-28"
              value={newRatePercent}
              onChange={(e) => setNewRatePercent(parseFloat(e.target.value) || 0)}
            />
          </div>
          <button className="btn-secondary" onClick={addRate}>
            + Add Rate
          </button>
        </div>
      </div>
    </div>
  );
}
