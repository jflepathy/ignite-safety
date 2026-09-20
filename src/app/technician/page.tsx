import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { StatusBadge } from '@/components/status-badge';

export default async function TechnicianHomePage() {
  const session = await getServerSession(authOptions);
  const isAdminPreview = session!.user.role === 'ADMIN';

  const workOrders = await prisma.workOrder.findMany({
    where: {
      deletedAt: null,
      status: { in: ['PENDING', 'SCHEDULED', 'IN_PROGRESS'] },
      ...(isAdminPreview ? {} : { assignedTechnicianId: session!.user.id }),
    },
    include: { customer: true, site: true },
    orderBy: { scheduledDate: 'asc' },
  });

  const today = new Date().toDateString();
  const todayJobs = workOrders.filter((w) => w.scheduledDate && w.scheduledDate.toDateString() === today);
  const otherJobs = workOrders.filter((w) => !w.scheduledDate || w.scheduledDate.toDateString() !== today);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-ink-900">Today's Jobs</h1>
        <p className="text-sm text-slate-500">{todayJobs.length} job(s) scheduled today</p>
      </div>

      <div className="space-y-3">
        {todayJobs.map((wo) => (
          <JobCard key={wo.id} wo={wo} />
        ))}
        {todayJobs.length === 0 && (
          <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">
            Nothing scheduled for today.
          </p>
        )}
      </div>

      {otherJobs.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-600">Upcoming / Unscheduled</h2>
          {otherJobs.map((wo) => (
            <JobCard key={wo.id} wo={wo} />
          ))}
        </div>
      )}
    </div>
  );
}

function JobCard({ wo }: { wo: any }) {
  return (
    <Link
      href={`/technician/${wo.id}`}
      className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm active:bg-slate-50"
    >
      <div className="flex items-center justify-between">
        <span className="font-semibold text-ink-900">{wo.woNumber}</span>
        <StatusBadge status={wo.status} />
      </div>
      <p className="mt-1 text-sm text-slate-600">{wo.customer.displayName}</p>
      <p className="text-xs text-slate-400">
        {wo.serviceType === 'ONSITE' ? '📍 Onsite' : '🔧 Workshop'} · {wo.locationDetails || wo.region || 'No location set'}
      </p>
      {wo.scheduledDate && (
        <p className="mt-1 text-xs text-slate-400">{new Date(wo.scheduledDate).toLocaleDateString()}</p>
      )}
    </Link>
  );
}
