import { prisma } from '@/lib/prisma';
import ScheduledJobsPanel from '@/components/admin/scheduled-jobs-panel';
import { formatDateTime } from '@/lib/format-date';

export default async function ScheduledJobsPage() {
  const [runs, settings] = await Promise.all([
    prisma.cronRun.findMany({ orderBy: { startedAt: 'desc' }, take: 30 }),
    prisma.appSettings.findUnique({ where: { id: 1 }, select: { autoPaymentRemindersEnabled: true, reminderScheduleDays: true, smartRemindersEnabled: true, reminderLeadDays: true } }),
  ]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">Scheduled jobs</h1>
        <p className="text-sm text-slate-500">
          Run automatically every day at 08:00 (Seychelles time). Preview shows what a job would do without doing it.
        </p>
      </div>
      <ScheduledJobsPanel
        reminders={{ on: settings?.autoPaymentRemindersEnabled ?? false, days: (settings?.reminderScheduleDays as number[]) ?? [] }}
        serviceDue={{ on: settings?.smartRemindersEnabled ?? false, lead: settings?.reminderLeadDays ?? 45 }}
      />
      <div className="card overflow-x-auto">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-ink-900">Recent runs</h2>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {runs.map((r) => (
              <tr key={r.id} className="border-b border-slate-50 align-top">
                <td className="whitespace-nowrap px-4 py-2 text-slate-500">{formatDateTime(r.startedAt)}</td>
                <td className="px-4 py-2 font-medium">{r.job}</td>
                <td className="px-4 py-2">{r.ok ? <span className="badge bg-emerald-100 text-emerald-700">OK</span> : <span className="badge bg-red-100 text-red-700">Problem</span>}</td>
                <td className="whitespace-pre-line px-4 py-2 text-slate-600">{r.summary}</td>
              </tr>
            ))}
            {runs.length === 0 && (
              <tr>
                <td className="px-4 py-8 text-center text-slate-400">No scheduled run yet - the first one happens at the next 08:00.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
