'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Settings = {
  defaultInvoiceEmailSubject: string | null;
  defaultInvoiceEmailBody: string | null;
  autoPaymentRemindersEnabled: boolean;
  reminderScheduleDays: number[];
};

export default function MessagesRemindersForm({ settings }: { settings: Settings }) {
  const router = useRouter();
  const [form, setForm] = useState(settings);
  const [scheduleText, setScheduleText] = useState((settings.reminderScheduleDays ?? []).join(', '));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    const reminderScheduleDays = scheduleText
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !Number.isNaN(n));
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, reminderScheduleDays }),
    });
    setSaving(false);
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="card space-y-4 p-6">
      <h2 className="text-sm font-semibold text-ink-900">Messages &amp; Reminders</h2>
      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className="label">Default Invoice Email Subject</label>
          <input
            className="input"
            value={form.defaultInvoiceEmailSubject ?? ''}
            onChange={(e) => setForm({ ...form, defaultInvoiceEmailSubject: e.target.value })}
          />
          <p className="mt-1 text-xs text-slate-400">Supports {'{{invoiceNumber}}'} and {'{{companyName}}'}.</p>
        </div>
        <div>
          <label className="label">Default Invoice Email Body</label>
          <textarea
            className="input"
            rows={4}
            value={form.defaultInvoiceEmailBody ?? ''}
            onChange={(e) => setForm({ ...form, defaultInvoiceEmailBody: e.target.value })}
          />
          <p className="mt-1 text-xs text-slate-400">Supports {'{{customerName}}'} and {'{{companyName}}'}.</p>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 pt-4">
        <div>
          <p className="text-sm font-medium text-ink-900">Automatic Payment Reminders</p>
          <p className="text-xs text-slate-500">Send reminder emails automatically around the due date.</p>
        </div>
        <button
          type="button"
          onClick={() => setForm((f) => ({ ...f, autoPaymentRemindersEnabled: !f.autoPaymentRemindersEnabled }))}
          className={`relative h-6 w-11 rounded-full transition-colors ${form.autoPaymentRemindersEnabled ? 'bg-brand-600' : 'bg-slate-300'}`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              form.autoPaymentRemindersEnabled ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      <div>
        <label className="label">Reminder Schedule (days relative to due date)</label>
        <input className="input" value={scheduleText} onChange={(e) => setScheduleText(e.target.value)} placeholder="-3, 0, 7, 14" />
        <p className="mt-1 text-xs text-slate-400">Negative numbers send before the due date, positive numbers after (overdue).</p>
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
