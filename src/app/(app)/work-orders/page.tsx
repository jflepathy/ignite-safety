import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { StatusBadge } from '@/components/status-badge';
import { formatDate } from '@/lib/format-date';

// Work orders don't carry a background job that flips their status, so how
// overdue a job is gets derived here at read time from its scheduled date,
// on a graduated scale rather than flipping to PAST_DUE the instant the
// scheduled date/time passes (Session 11 fix — a job scheduled for earlier
// today isn't "past due" yet):
//   days 0–3 late:  still PENDING/SCHEDULED, no flag
//   days 4–6 late:  WARNING
//   day 7+ late:    PAST_DUE
function displayStatus(status: string, scheduledDate: Date | null): string {
  if ((status === 'PENDING' || status === 'SCHEDULED') && scheduledDate) {
    const daysLate = (Date.now() - scheduledDate.getTime()) / 86_400_000;
    if (daysLate >= 7) return 'PAST_DUE';
    if (daysLate >= 4) return 'WARNING';
  }
  return status;
}

export default async function WorkOrdersPage() {
  const workOrders = await prisma.workOrder.findMany({
    where: { deletedAt: null },
    include: { customer: true, assignedTechnician: true },
    orderBy: { scheduledDate: 'asc' },
    take: 300,
  });

  const withDisplayStatus = workOrders.map((wo) => ({ ...wo, displayStatus: displayStatus(wo.status, wo.scheduledDate) }));

  const counts = {
    PAST_DUE: withDisplayStatus.filter((w) => w.displayStatus === 'PAST_DUE').length,
    WARNING: withDisplayStatus.filter((w) => w.displayStatus === 'WARNING').length,
    PENDING: withDisplayStatus.filter((w) => w.displayStatus === 'PENDING').length,
    SCHEDULED: withDisplayStatus.filter((w) => w.displayStatus === 'SCHEDULED').length,
    IN_PROGRESS: withDisplayStatus.filter((w) => w.displayStatus === 'IN_PROGRESS').length,
    COMPLETED: withDisplayStatus.filter((w) => w.displayStatus === 'COMPLETED').length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">Active Work Orders</h1>
        <p className="text-sm text-slate-500">Digital work order tracking across onsite &amp; workshop jobs.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {Object.entries(counts).map(([status, count]) => (
          <div key={status} className="card p-4 text-center">
            <p className="text-xs uppercase text-slate-500">{status.replace('_', ' ')}</p>
            <p
              className={`mt-1 text-2xl font-semibold ${
                status === 'PAST_DUE' ? 'text-red-600' : status === 'WARNING' ? 'text-orange-600' : 'text-ink-900'
              }`}
            >
              {count}
            </p>
          </div>
        ))}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">WO Number</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Technician</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {withDisplayStatus.map((wo) => (
              <tr key={wo.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/work-orders/${wo.id}`} className="font-medium text-brand-700 hover:underline">
                    {wo.woNumber}
                  </Link>
                </td>
                <td className="px-4 py-3">{wo.customer.displayName}</td>
                <td className="px-4 py-3">{wo.serviceType === 'ONSITE' ? 'Onsite' : 'Workshop'}</td>
                <td className="px-4 py-3 text-slate-500">
                  {wo.scheduledDate ? formatDate(wo.scheduledDate) : '—'}
                </td>
                <td className="px-4 py-3 text-slate-500">{wo.assignedTechnician?.name ?? 'Unassigned'}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={wo.displayStatus} />
                </td>
                <td className="px-4 py-3 text-right">
                  {wo.status !== 'COMPLETED' && wo.status !== 'CANCELLED' && (
                    <Link href={`/technician/${wo.id}`} className="text-xs font-medium text-brand-700 hover:underline">
                      Open in POS →
                    </Link>
                  )}
                </td>
              </tr>
            ))}
            {withDisplayStatus.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  No work orders yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
