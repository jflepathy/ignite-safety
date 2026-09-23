import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { StatusBadge } from '@/components/status-badge';
import NewJobButton from '@/components/technician/new-job-button';
import ClaimJobButton from '@/components/technician/claim-job-button';
import { isStaleAssignment, STALE_ASSIGNMENT_DAYS } from '@/lib/work-order-status';

export default async function TechnicianHomePage() {
  const session = await getServerSession(authOptions);
  const isAdminPreview = session!.user.role === 'ADMIN';
  const fourDaysAgo = new Date(Date.now() - STALE_ASSIGNMENT_DAYS * 86_400_000);

  const [workOrders, customers, settings] = await Promise.all([
    prisma.workOrder.findMany({
      where: {
        deletedAt: null,
        status: { in: ['PENDING', 'SCHEDULED', 'IN_PROGRESS'] },
        // Open to any technician to pick up: never assigned, already theirs
        // (primary or one of the additional technicians on it — Session 20),
        // or assigned to someone else but idle 4+ days (stale — see
        // work-order-status.ts). Once a job is freshly assigned, only those
        // technicians see it (Session 11/12).
        ...(isAdminPreview
          ? {}
          : {
              OR: [
                { assignedTechnicianId: null },
                { assignedTechnicianId: session!.user.id },
                { additionalTechnicians: { some: { technicianId: session!.user.id } } },
                { assignedTechnicianId: { not: session!.user.id }, updatedAt: { lte: fourDaysAgo } },
              ],
            }),
      },
      include: { customer: true, site: true, additionalTechnicians: true },
      orderBy: { scheduledDate: 'asc' },
    }),
    isAdminPreview
      ? Promise.resolve([])
      : prisma.customer.findMany({ where: { deletedAt: null }, select: { id: true, displayName: true }, orderBy: { displayName: 'asc' } }),
    prisma.appSettings.findUnique({ where: { id: 1 }, select: { companyAddress: true } }),
  ]);

  const today = new Date().toDateString();
  const todayJobs = workOrders.filter((w) => w.scheduledDate && w.scheduledDate.toDateString() === today);
  const otherJobs = workOrders.filter((w) => !w.scheduledDate || w.scheduledDate.toDateString() !== today);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-ink-900">Today's Jobs</h1>
        <p className="text-sm text-slate-500">{todayJobs.length} job(s) scheduled today</p>
      </div>

      {!isAdminPreview && (
        <NewJobButton customers={customers.map((c) => ({ id: c.id, name: c.displayName }))} workshopAddress={settings?.companyAddress ?? null} />
      )}

      <div className="space-y-3">
        {todayJobs.map((wo) => (
          <JobCard key={wo.id} wo={wo} technicianId={isAdminPreview ? null : session!.user.id} />
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
            <JobCard key={wo.id} wo={wo} technicianId={isAdminPreview ? null : session!.user.id} />
          ))}
        </div>
      )}
    </div>
  );
}

function JobCard({ wo, technicianId }: { wo: any; technicianId: string | null }) {
  const stale = isStaleAssignment(wo);
  // "Mine" includes being an admin-added additional technician on this job
  // (Session 20), not just the primary assignedTechnicianId.
  const isMine =
    wo.assignedTechnicianId === technicianId ||
    (technicianId && (wo.additionalTechnicians ?? []).some((t: any) => t.technicianId === technicianId));
  const claimable = technicianId && !isMine && (!wo.assignedTechnicianId || stale);

  return (
    <div className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <Link href={`/technician/${wo.id}`} className="block active:opacity-70">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-ink-900">{wo.woNumber}</span>
          <div className="flex items-center gap-1.5">
            {!wo.assignedTechnicianId && <span className="badge bg-amber-100 text-amber-700">Unassigned — tap to claim</span>}
            {stale && wo.assignedTechnicianId && <span className="badge bg-orange-100 text-orange-700">Idle 4+ days — up for grabs</span>}
            <StatusBadge status={wo.status} />
          </div>
        </div>
        <p className="mt-1 text-sm text-slate-600">{wo.customer.displayName}</p>
        <p className="text-xs text-slate-400">
          {wo.serviceType === 'ONSITE' ? '📍 Onsite' : '🔧 Workshop'} · {wo.locationDetails || wo.region || 'No location set'}
          {(wo.additionalTechnicians ?? []).length > 0 &&
            ` · 👥 +${wo.additionalTechnicians.length} teammate${wo.additionalTechnicians.length === 1 ? '' : 's'}`}
        </p>
        {wo.scheduledDate && (
          <p className="mt-1 text-xs text-slate-400">{new Date(wo.scheduledDate).toLocaleDateString()}</p>
        )}
      </Link>
      {claimable && (
        <div className="mt-2">
          <ClaimJobButton workOrderId={wo.id} technicianId={technicianId!} woNumber={wo.woNumber} customerName={wo.customer.displayName} />
        </div>
      )}
    </div>
  );
}
