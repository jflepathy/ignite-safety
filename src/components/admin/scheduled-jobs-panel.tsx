'use client';

import { useState } from 'react';

const JOBS = [
  { key: 'recurring', title: 'Recurring invoices', desc: 'Creates the next invoice for each active recurring template that has reached its date. Issued, not emailed.' },
  { key: 'reminders', title: 'Payment reminders', desc: 'Emails customers on the reminder schedule in Settings (days before/after the due date). Needs the customer to have an email.' },
  { key: 'service-due', title: 'Service-due notices', desc: 'Raises a Servicing Request for customers whose annual service falls due within the lead time in Settings.' },
] as const;

export default function ScheduledJobsPanel({ reminders, serviceDue }: { reminders: { on: boolean; days: number[] }; serviceDue: { on: boolean; lead: number } }) {
  const [out, setOut] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function run(job: string, real: boolean) {
    if (real && !confirm('Run this job for real now? Emails and records will be created.')) return;
    setBusy(job + real);
    try {
      const res = await fetch(`/api/cron/${job}?dryRun=${real ? '0' : '1'}`, { method: 'POST' });
      const body = await res.json().catch(() => ({ summary: 'Failed' }));
      setOut((o) => ({ ...o, [job]: { ...body, real } }));
    } finally {
      setBusy(null);
    }
  }

  const note = (key: string) =>
    key === 'reminders'
      ? reminders.on
        ? `On: reminders at ${reminders.days.join(', ')} days from the due date.`
        : 'Switched off in Settings > Messages & Reminders.'
      : key === 'service-due'
        ? serviceDue.on
          ? `On: ${serviceDue.lead} days ahead.`
          : 'Switched off in Settings > Scheduling.'
        : '';

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {JOBS.map((j) => (
        <div key={j.key} className="card space-y-2 p-4">
          <h2 className="text-sm font-semibold text-ink-900">{j.title}</h2>
          <p className="text-xs text-slate-500">{j.desc}</p>
          {note(j.key) && <p className="text-xs font-medium text-slate-600">{note(j.key)}</p>}
          <div className="flex gap-2">
            <button className="btn-secondary" disabled={!!busy} onClick={() => run(j.key, false)}>{busy === j.key + false ? 'Checking…' : 'Preview'}</button>
            <button className="btn-secondary" disabled={!!busy} onClick={() => run(j.key, true)}>{busy === j.key + true ? 'Running…' : 'Run now'}</button>
          </div>
          {out[j.key] && (
            <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs">
              <p className="font-medium">{out[j.key].real ? 'Ran: ' : 'Preview: '}{out[j.key].summary ?? out[j.key].error}</p>
              {(out[j.key].items ?? []).map((i: string, k: number) => (
                <p key={k} className="text-slate-600">{i}</p>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
