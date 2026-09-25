import { prisma } from '@/lib/prisma';
import { StatusBadge } from '@/components/status-badge';
import ConvertToWorkOrderButton from '@/components/outreach/convert-button';
import { formatDate } from '@/lib/format-date';

export default async function ServiceRequestsPage() {
  const requests = await prisma.serviceRequest.findMany({
    include: { customer: true, equipmentCounts: true },
    orderBy: { proposedDate: 'asc' },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">Servicing Requests</h1>
        <p className="text-sm text-slate-500">New requests created from outreach or manually, awaiting scheduling.</p>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Request #</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Proposed Date</th>
              <th className="px-4 py-3">Region</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">{r.requestNumber}</td>
                <td className="px-4 py-3">{r.customer.displayName}</td>
                <td className="px-4 py-3">{r.serviceType === 'ONSITE' ? 'Onsite' : 'Workshop'}</td>
                <td className="px-4 py-3 text-slate-500">{formatDate(r.proposedDate)}</td>
                <td className="px-4 py-3 text-slate-500">{r.region ?? '—'}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={r.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  {r.status === 'NEW' && <ConvertToWorkOrderButton id={r.id} />}
                </td>
              </tr>
            ))}
            {requests.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  No servicing requests yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
