import { prisma } from '@/lib/prisma';
import Link from 'next/link';

export default async function TimeTrackingPage() {
  const activities = await prisma.timeActivity.findMany({
    include: { employee: true },
    orderBy: { date: 'desc' },
    take: 200,
  });
  const totalHours = activities.reduce((s, a) => s + Number(a.hours), 0);
  const billableHours = activities.filter((a) => a.billable).reduce((s, a) => s + Number(a.hours), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Time Tracking</h1>
          <p className="text-sm text-slate-500">Hours logged by the team, billable and non-billable.</p>
        </div>
        <Link href="/team/time-tracking/new" className="btn-primary">
          + Single Time Activity
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="card p-4">
          <p className="text-xs uppercase text-slate-500">Total Hours (last 200)</p>
          <p className="text-2xl font-semibold text-ink-900">{totalHours.toFixed(1)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase text-slate-500">Billable Hours</p>
          <p className="text-2xl font-semibold text-ink-900">{billableHours.toFixed(1)}</p>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3 text-right">Hours</th>
              <th className="px-4 py-3">Billable</th>
            </tr>
          </thead>
          <tbody>
            {activities.map((a) => (
              <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-500">{a.date.toLocaleDateString()}</td>
                <td className="px-4 py-3 font-medium text-ink-900">{a.employee.name}</td>
                <td className="px-4 py-3 text-slate-500">{a.serviceDescription ?? '—'}</td>
                <td className="px-4 py-3 text-right">{Number(a.hours).toFixed(1)}</td>
                <td className="px-4 py-3 text-slate-500">{a.billable ? 'Yes' : 'No'}</td>
              </tr>
            ))}
            {activities.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                  No time logged yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
