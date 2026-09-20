'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Settings = {
  dailyTeamCapacity: number;
  smartRemindersEnabled: boolean;
  overdueThresholdDays: number;
  defaultServiceIntervalMonths: number;
  reminderLeadDays: number;
  workOrderPrefix: string;
  serviceRequestPrefix: string;
};

export default function SchedulingSettingsForm({ settings }: { settings: Settings }) {
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
      <h2 className="text-sm font-semibold text-ink-900">Scheduling & Dispatch Engine</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Daily Team Capacity</label>
          <input
            type="number"
            min={1}
            className="input"
            value={form.dailyTeamCapacity}
            onChange={(e) => setForm({ ...form, dailyTeamCapacity: parseInt(e.target.value) || 1 })}
          />
          <p className="mt-1 text-xs text-slate-400">Number of service teams available per day, used for availability checks.</p>
        </div>
        <div>
          <label className="label">Overdue Threshold (days)</label>
          <input
            type="number"
            min={0}
            className="input"
            value={form.overdueThresholdDays}
            onChange={(e) => setForm({ ...form, overdueThresholdDays: parseInt(e.target.value) || 0 })}
          />
        </div>
        <div>
          <label className="label">Default Service Interval (months)</label>
          <input
            type="number"
            min={1}
            className="input"
            value={form.defaultServiceIntervalMonths}
            onChange={(e) => setForm({ ...form, defaultServiceIntervalMonths: parseInt(e.target.value) || 1 })}
          />
        </div>
        <div>
          <label className="label">Reminder Lead Time (days)</label>
          <input
            type="number"
            min={0}
            className="input"
            value={form.reminderLeadDays}
            onChange={(e) => setForm({ ...form, reminderLeadDays: parseInt(e.target.value) || 0 })}
          />
        </div>
        <div>
          <label className="label">Work Order Prefix</label>
          <input className="input" value={form.workOrderPrefix} onChange={(e) => setForm({ ...form, workOrderPrefix: e.target.value })} />
        </div>
        <div>
          <label className="label">Service Request Prefix</label>
          <input
            className="input"
            value={form.serviceRequestPrefix}
            onChange={(e) => setForm({ ...form, serviceRequestPrefix: e.target.value })}
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={form.smartRemindersEnabled}
          onChange={(e) => setForm({ ...form, smartRemindersEnabled: e.target.checked })}
        />
        Enable predictive smart reminders on the Outreach dashboard
      </label>
      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={saving} onClick={save}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
        {saved && <span className="text-sm text-emerald-600">Saved ✓</span>}
      </div>
    </div>
  );
}
