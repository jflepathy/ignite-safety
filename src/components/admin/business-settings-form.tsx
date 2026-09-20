'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Settings = {
  companyName: string;
  legalName: string | null;
  companyAddress: string | null;
  companyPhone: string | null;
  companyEmail: string | null;
  taxRegistrationNumber: string | null;
  businessRegistrationNumber: string | null;
  registeredOwners: string | null;
  businessType: string | null;
  industry: string | null;
  currencyCode: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  invoiceTermsDefault: string | null;
  chartOfAccountsLimit: number | null;
  billableUserLimit: number | null;
  customKpiLimit: number | null;
};

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const BUSINESS_TYPES = ['Sole Proprietorship', 'Partnership', 'Limited Company', 'Non-Profit'];

export default function BusinessSettingsForm({ settings }: { settings: Settings }) {
  const router = useRouter();
  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [logoError, setLogoError] = useState('');

  async function handleLogoUpload(file: File, field: 'logoUrl' | 'faviconUrl') {
    if (file.size > 2 * 1024 * 1024) {
      setLogoError('Logo images should be under 2MB.');
      return;
    }
    setLogoError('');
    try {
      const dataUrl = await readAsDataUrl(file);
      setForm((f) => ({ ...f, [field]: dataUrl }));
    } catch {
      setLogoError('Could not read that image file.');
    }
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

  return (
    <div className="space-y-6">
      <div className="card space-y-4 p-6">
        <h2 className="text-sm font-semibold text-ink-900">Company Profile</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Company Name (trading as)</label>
            <input className="input" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
          </div>
          <div>
            <label className="label">Legal Name</label>
            <input className="input" value={form.legalName ?? ''} onChange={(e) => setForm({ ...form, legalName: e.target.value })} />
          </div>
          <div>
            <label className="label">Business Type</label>
            <select className="input" value={form.businessType ?? ''} onChange={(e) => setForm({ ...form, businessType: e.target.value })}>
              {BUSINESS_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Industry</label>
            <input className="input" value={form.industry ?? ''} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
          </div>
          <div>
            <label className="label">Currency Code</label>
            <select className="input" value={form.currencyCode} onChange={(e) => setForm({ ...form, currencyCode: e.target.value })}>
              <option value="SCR">SCR — Seychellois Rupee</option>
              <option value="USD">USD — US Dollar</option>
              <option value="EUR">EUR — Euro</option>
            </select>
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" value={form.companyPhone ?? ''} onChange={(e) => setForm({ ...form, companyPhone: e.target.value })} />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" value={form.companyEmail ?? ''} onChange={(e) => setForm({ ...form, companyEmail: e.target.value })} />
          </div>
          <div>
            <label className="label">Tax / VAT Registration Number (TIN)</label>
            <input
              className="input"
              value={form.taxRegistrationNumber ?? ''}
              onChange={(e) => setForm({ ...form, taxRegistrationNumber: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Business Registration Number (BRN)</label>
            <input
              className="input"
              value={form.businessRegistrationNumber ?? ''}
              onChange={(e) => setForm({ ...form, businessRegistrationNumber: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Registered Owners / Partners</label>
            <input
              className="input"
              value={form.registeredOwners ?? ''}
              onChange={(e) => setForm({ ...form, registeredOwners: e.target.value })}
              placeholder="As shown on the Certificate of Registration"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Address</label>
            <textarea className="input" rows={2} value={form.companyAddress ?? ''} onChange={(e) => setForm({ ...form, companyAddress: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Default Invoice Terms</label>
            <textarea
              className="input"
              rows={2}
              value={form.invoiceTermsDefault ?? ''}
              onChange={(e) => setForm({ ...form, invoiceTermsDefault: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div className="card space-y-4 p-6">
        <h2 className="text-sm font-semibold text-ink-900">Logos</h2>
        <p className="text-sm text-slate-500">
          The document logo appears on invoices, estimates, receipts and the sidebar. The favicon appears in the browser tab —
          use a transparent-background image for best results.
        </p>
        {logoError && <p className="text-sm text-red-600">{logoError}</p>}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label className="label">Document / Form Logo (white or opaque background)</label>
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white p-1">
                {form.logoUrl ? (
                  <img src={form.logoUrl} alt="Document logo" className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-xs text-slate-300">None</span>
                )}
              </div>
              <div className="space-y-1">
                <label className="btn-secondary cursor-pointer text-xs">
                  {form.logoUrl ? 'Change' : 'Upload'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleLogoUpload(file, 'logoUrl');
                      e.target.value = '';
                    }}
                  />
                </label>
                {form.logoUrl && (
                  <button type="button" className="block text-xs text-slate-400 hover:text-red-600" onClick={() => setForm({ ...form, logoUrl: null })}>
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>
          <div>
            <label className="label">Favicon (transparent background)</label>
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-[repeating-conic-gradient(#e2e8f0_0%_25%,white_0%_50%)] bg-[length:10px_10px] p-1">
                {form.faviconUrl ? (
                  <img src={form.faviconUrl} alt="Favicon" className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-xs text-slate-400">None</span>
                )}
              </div>
              <div className="space-y-1">
                <label className="btn-secondary cursor-pointer text-xs">
                  {form.faviconUrl ? 'Change' : 'Upload'}
                  <input
                    type="file"
                    accept="image/png,image/svg+xml"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleLogoUpload(file, 'faviconUrl');
                      e.target.value = '';
                    }}
                  />
                </label>
                {form.faviconUrl && (
                  <button type="button" className="block text-xs text-slate-400 hover:text-red-600" onClick={() => setForm({ ...form, faviconUrl: null })}>
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card space-y-4 p-6">
        <h2 className="text-sm font-semibold text-ink-900">Usage Limits</h2>
        <p className="text-sm text-slate-500">Display-only guardrails — shown as reference, not hard-enforced.</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Chart of Accounts Limit</label>
            <input
              type="number"
              className="input"
              value={form.chartOfAccountsLimit ?? ''}
              onChange={(e) => setForm({ ...form, chartOfAccountsLimit: e.target.value ? parseInt(e.target.value, 10) : null })}
            />
          </div>
          <div>
            <label className="label">Billable User Limit</label>
            <input
              type="number"
              className="input"
              value={form.billableUserLimit ?? ''}
              onChange={(e) => setForm({ ...form, billableUserLimit: e.target.value ? parseInt(e.target.value, 10) : null })}
            />
          </div>
          <div>
            <label className="label">Custom KPI Limit</label>
            <input
              type="number"
              className="input"
              value={form.customKpiLimit ?? ''}
              onChange={(e) => setForm({ ...form, customKpiLimit: e.target.value ? parseInt(e.target.value, 10) : null })}
            />
          </div>
        </div>
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
