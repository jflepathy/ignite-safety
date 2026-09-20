'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Settings = {
  weekStartDay: string;
  timesheetFields: string[];
  billableTimeEnabled: boolean;
};

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const FIELD_OPTIONS = ['service', 'customer', 'billable', 'location', 'notes'];

export default function TimeTrackingSettingsForm({ settings }: { settings: Settings }) {
  const router = useRouter();
  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function toggleField(field: string) {
    setForm((f) => ({
      ...f,
      timesheetFields: f.timesheetFields.includes(field) ? f.timesheetFields.filter((x) => x !== field) : [...f.timesheetFields, field],
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

  return (
    <div className="card space-y-4 p-6">
      <h2 className="text-sm font-semibold text-ink-900">Time Tracking</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Week Starts On</label>
          <select className="input" value={form.weekStartDay} onChange={(e) => setForm({ ...form, weekStartDay: e.target.value })}>
            {DAYS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3">
          <span className="text-sm font-medium text-ink-900">Billable Time</span>
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, billableTimeEnabled: !f.billableTimeEnabled }))}
            className={`relative h-6 w-11 rounded-full transition-colors ${form.billableTimeEnabled ? 'bg-brand-600' : 'bg-slate-300'}`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                form.billableTimeEnabled ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>
      <div>
        <label className="label">Timesheet Fields</label>
        <div className="flex flex-wrap gap-2">
          {FIELD_OPTIONS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => toggleField(f)}
              className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${
                form.timesheetFields.includes(f) ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-500'
              }`}
            >
              {f}
            </button>
          ))}
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
