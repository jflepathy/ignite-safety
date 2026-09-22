'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import NewServiceRequestWizard from './new-service-request-wizard';
import { EQUIPMENT_CATEGORIES } from '@/lib/equipment-categories';

type Customer = {
  id: string;
  displayName: string;
  phone: string | null;
  contactPerson?: string | null;
  region: string | null;
  district?: string | null;
  email?: string | null;
  address?: string | null;
};
type Technician = { id: string; name: string };
type PendingRequest = {
  id: string;
  requestNumber: string;
  customerName: string;
  serviceType: string;
  proposedDate: string;
  region: string | null;
  district: string | null;
  status: string;
  totalEquipment: number;
};

type OutreachRow = {
  equipmentId: string;
  customerId: string;
  customerName: string;
  category: string;
  serialNumber: string | null;
  region: string | null;
  lastServiceDate: string | null;
  nextDueDate: string;
  daysUntilDue: number;
  overdue: boolean;
};

type ClientRow = {
  customerId: string;
  customerName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  region: string | null;
  equipmentSummary: { category: string; count: number }[];
  totalEquipment: number;
  soonestDueDate: string;
  soonestDaysUntilDue: number;
  soonestEquipmentId: string;
  overdue: boolean;
  overdueCount: number;
};

const categoryLabel = (v: string) => EQUIPMENT_CATEGORIES.find((c) => c.value === v)?.label ?? v;

function aggregateByClient(rows: OutreachRow[]): ClientRow[] {
  const byCustomer = new Map<string, OutreachRow[]>();
  for (const r of rows) {
    const list = byCustomer.get(r.customerId) ?? [];
    list.push(r);
    byCustomer.set(r.customerId, list);
  }

  const clients: ClientRow[] = [];
  for (const [customerId, items] of byCustomer.entries()) {
    const sorted = [...items].sort((a, b) => a.daysUntilDue - b.daysUntilDue);
    const soonest = sorted[0];
    const categoryCounts = new Map<string, number>();
    for (const it of items) categoryCounts.set(it.category, (categoryCounts.get(it.category) ?? 0) + 1);

    clients.push({
      customerId,
      customerName: soonest.customerName,
      phone: null,
      email: null,
      address: null,
      region: soonest.region,
      equipmentSummary: Array.from(categoryCounts.entries()).map(([category, count]) => ({ category, count })),
      totalEquipment: items.length,
      soonestDueDate: soonest.nextDueDate,
      soonestDaysUntilDue: soonest.daysUntilDue,
      soonestEquipmentId: soonest.equipmentId,
      overdue: soonest.overdue,
      overdueCount: items.filter((i) => i.overdue).length,
    });
  }

  return clients.sort((a, b) => a.soonestDaysUntilDue - b.soonestDaysUntilDue);
}

export default function OutreachClient({
  customers,
  initialRows,
  scheduledCount,
  technicians,
  pendingRequests,
  workshopAddress,
}: {
  customers: Customer[];
  initialRows: OutreachRow[];
  scheduledCount: number;
  technicians: Technician[];
  pendingRequests: PendingRequest[];
  workshopAddress?: string | null;
}) {
  const router = useRouter();
  const [rows] = useState(initialRows);
  const [filter, setFilter] = useState<'all' | 'overdue' | 'dueSoon' | 'planned'>('all');
  const [wizard, setWizard] = useState<{ customerId?: string; equipmentId?: string } | null>(null);
  const [converting, setConverting] = useState<string | null>(null);

  async function convertToWorkOrder(id: string) {
    setConverting(id);
    try {
      const res = await fetch(`/api/service-requests/${id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const wo = await res.json();
        router.push(`/work-orders/${wo.id}`);
        router.refresh();
      }
    } finally {
      setConverting(null);
    }
  }

  const customerLookup = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);

  const clientRows = useMemo(() => {
    const aggregated = aggregateByClient(rows);
    return aggregated.map((c) => {
      const customer = customerLookup.get(c.customerId);
      return { ...c, phone: customer?.phone ?? null, email: customer?.email ?? null, address: customer?.address ?? null };
    });
  }, [rows, customerLookup]);

  const overdueClients = clientRows.filter((c) => c.overdue);
  const dueSoonClients = clientRows.filter((c) => !c.overdue && c.soonestDaysUntilDue <= 30);
  const upcomingPlannedClients = clientRows.filter((c) => !c.overdue && c.soonestDaysUntilDue > 30);

  const visible =
    filter === 'overdue'
      ? overdueClients
      : filter === 'dueSoon'
        ? dueSoonClients
        : filter === 'planned'
          ? upcomingPlannedClients
          : clientRows;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Servicing Outreach</h1>
          <p className="text-sm text-slate-500">Predictive service cycles across all customer equipment.</p>
        </div>
        <button className="btn-primary" onClick={() => setWizard({})}>
          + New Servicing Request
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <button
          onClick={() => setFilter('all')}
          className={`card p-4 text-left ${filter === 'all' ? 'ring-2 ring-brand-500' : ''}`}
        >
          <p className="text-xs font-medium uppercase text-slate-500">Total Pipeline</p>
          <p className="mt-1 text-2xl font-semibold text-ink-900">{clientRows.length}</p>
          <p className="mt-1 text-xs text-slate-400">{rows.length} equipment items across all clients</p>
        </button>
        <button
          onClick={() => setFilter('overdue')}
          className={`card p-4 text-left ${filter === 'overdue' ? 'ring-2 ring-red-500' : ''}`}
        >
          <p className="text-xs font-medium uppercase text-slate-500">Overdue Service</p>
          <p className="mt-1 text-2xl font-semibold text-red-600">{overdueClients.length}</p>
          <p className="mt-1 text-xs text-slate-400">clients with at least one overdue item</p>
        </button>
        <button
          onClick={() => setFilter('dueSoon')}
          className={`card p-4 text-left ${filter === 'dueSoon' ? 'ring-2 ring-amber-500' : ''}`}
        >
          <p className="text-xs font-medium uppercase text-slate-500">Due This Month / Soon</p>
          <p className="mt-1 text-2xl font-semibold text-amber-600">{dueSoonClients.length}</p>
          <p className="mt-1 text-xs text-slate-400">next due date within 30 days</p>
        </button>
        <button
          onClick={() => setFilter('planned')}
          className={`card p-4 text-left ${filter === 'planned' ? 'ring-2 ring-emerald-500' : ''}`}
        >
          <p className="text-xs font-medium uppercase text-slate-500">Upcoming Planned</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-600">{scheduledCount}</p>
          <p className="mt-1 text-xs text-slate-400">service requests already scheduled</p>
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Client Name</th>
              <th className="px-4 py-3">Contact Info</th>
              <th className="px-4 py-3">Location / Address</th>
              <th className="px-4 py-3">Equipment Profile</th>
              <th className="px-4 py-3">Due Date</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((c) => (
              <tr key={c.customerId} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-ink-900">{c.customerName}</td>
                <td className="px-4 py-3 text-slate-500">
                  <div>{c.phone ?? '—'}</div>
                  {c.email && <div className="text-xs text-slate-400">{c.email}</div>}
                </td>
                <td className="px-4 py-3 text-slate-500">{c.address ?? c.region ?? '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {c.equipmentSummary.map((e) => (
                      <span key={e.category} className="badge bg-slate-100 text-slate-700">
                        {e.count}× {categoryLabel(e.category)}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-slate-600">{new Date(c.soonestDueDate).toLocaleDateString()}</div>
                  {c.overdue ? (
                    <span className="badge bg-red-100 text-red-700">
                      Overdue {Math.abs(c.soonestDaysUntilDue)}d{c.overdueCount > 1 ? ` (${c.overdueCount} items)` : ''}
                    </span>
                  ) : c.soonestDaysUntilDue <= 30 ? (
                    <span className="badge bg-amber-100 text-amber-700">Due in {c.soonestDaysUntilDue}d</span>
                  ) : (
                    <span className="badge bg-emerald-100 text-emerald-700">On track</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    className="btn-secondary"
                    onClick={() => setWizard({ customerId: c.customerId, equipmentId: c.soonestEquipmentId })}
                  >
                    Schedule
                  </button>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  Nothing to show for this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pendingRequests.length > 0 && (
        <div className="card overflow-x-auto">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-ink-900">Servicing Requests Queue</h2>
            <p className="text-xs text-slate-500">Requests not yet generated into a Work Order.</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
                <th className="px-4 py-3">Request #</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Proposed Date</th>
                <th className="px-4 py-3">Region / District</th>
                <th className="px-4 py-3 text-right">Equipment</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {pendingRequests.map((r) => (
                <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-ink-900">{r.requestNumber}</td>
                  <td className="px-4 py-3 text-slate-500">{r.customerName}</td>
                  <td className="px-4 py-3 text-slate-500">{r.serviceType}</td>
                  <td className="px-4 py-3 text-slate-500">{new Date(r.proposedDate).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {r.region ?? '—'} {r.district && `/ ${r.district}`}
                  </td>
                  <td className="px-4 py-3 text-right">{r.totalEquipment}</td>
                  <td className="px-4 py-3 text-right">
                    <button className="btn-secondary" disabled={converting === r.id} onClick={() => convertToWorkOrder(r.id)}>
                      {converting === r.id ? 'Generating…' : 'Generate Work Order'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {wizard && (
        <NewServiceRequestWizard
          customers={customers}
          technicians={technicians}
          initialCustomerId={wizard.customerId}
          initialSourceEquipmentId={wizard.equipmentId}
          onClose={() => setWizard(null)}
          workshopAddress={workshopAddress}
        />
      )}
    </div>
  );
}
