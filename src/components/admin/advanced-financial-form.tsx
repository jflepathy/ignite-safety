'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Settings = {
  accountingMethod: 'ACCRUAL' | 'CASH';
  fiscalYearStartMonth: number;
  taxYearStartMonth: number;
  booksClosedDate: string | null;
  multiCurrencyEnabled: boolean;
  baseCurrency: string;
  autoPrefillFormsEnabled: boolean;
  autoApplyBillPaymentsEnabled: boolean;
  projectTrackingEnabled: boolean;
  numberFormat: string;
  warnOnDuplicateCheckNumber: boolean;
  warnOnDuplicateBillNumber: boolean;
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const TOGGLES: { key: keyof Settings; label: string; description: string }[] = [
  { key: 'multiCurrencyEnabled', label: 'Multi-Currency', description: 'Allow transactions in currencies other than your base currency.' },
  { key: 'autoPrefillFormsEnabled', label: 'Auto-Prefill Forms', description: 'Suggest values based on the last transaction for a customer/supplier.' },
  { key: 'autoApplyBillPaymentsEnabled', label: 'Auto-Apply Bill Payments', description: 'Apply supplier credits to open bills automatically.' },
  { key: 'projectTrackingEnabled', label: 'Project Tracking', description: 'Track income and expenses by project/job.' },
  { key: 'warnOnDuplicateCheckNumber', label: 'Warn on Duplicate Check #', description: 'Flag a check number already used for this account.' },
  { key: 'warnOnDuplicateBillNumber', label: 'Warn on Duplicate Bill #', description: "Flag a supplier's bill number already recorded." },
];

export default function AdvancedFinancialForm({ settings }: { settings: Settings }) {
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
      <h2 className="text-sm font-semibold text-ink-900">Advanced &amp; Financial Preferences</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Accounting Method</label>
          <select className="input" value={form.accountingMethod} onChange={(e) => setForm({ ...form, accountingMethod: e.target.value as 'ACCRUAL' | 'CASH' })}>
            <option value="ACCRUAL">Accrual</option>
            <option value="CASH">Cash</option>
          </select>
        </div>
        <div>
          <label className="label">Number Format</label>
          <select className="input" value={form.numberFormat} onChange={(e) => setForm({ ...form, numberFormat: e.target.value })}>
            <option value="#,##0.00">1,234.56</option>
            <option value="#.##0,00">1.234,56</option>
          </select>
        </div>
        <div>
          <label className="label">Fiscal Year Start</label>
          <select
            className="input"
            value={form.fiscalYearStartMonth}
            onChange={(e) => setForm({ ...form, fiscalYearStartMonth: parseInt(e.target.value, 10) })}
          >
            {MONTHS.map((m, idx) => (
              <option key={m} value={idx + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Tax Year Start</label>
          <select
            className="input"
            value={form.taxYearStartMonth}
            onChange={(e) => setForm({ ...form, taxYearStartMonth: parseInt(e.target.value, 10) })}
          >
            {MONTHS.map((m, idx) => (
              <option key={m} value={idx + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Books Closed Through</label>
          <input
            type="date"
            className="input"
            value={form.booksClosedDate ? form.booksClosedDate.slice(0, 10) : ''}
            onChange={(e) => setForm({ ...form, booksClosedDate: e.target.value || null })}
          />
          <p className="mt-1 text-xs text-slate-400">Transactions on or before this date are locked. Enforcement coming soon.</p>
        </div>
        <div>
          <label className="label">Base Currency</label>
          <select className="input" value={form.baseCurrency} onChange={(e) => setForm({ ...form, baseCurrency: e.target.value })}>
            <option value="SCR">SCR</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
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
