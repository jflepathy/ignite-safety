'use client';

import { useEffect, useState } from 'react';

type Availability = { capacity: number; booked: number; remaining: number; available: boolean };
type Technician = { id: string; name: string };

/**
 * Triggered by "Check Availability & Schedule". Shows the System Analysis
 * (date/capacity availability), Client Name, Scheduled Date, Team
 * Assignment, and Total Equipment Count, then Cancel/Confirm. Confirming
 * creates the Servicing Request AND immediately converts it into a
 * scheduled Work Order — this is what fixes newly created Servicing
 * Requests never showing up as an openable Work Order: previously nothing
 * in the UI ever called the (already-existing) convert endpoint.
 */
export default function SmartSchedulingModal({
  clientName,
  proposedDate,
  totalEquipmentCount,
  technicians,
  onCancel,
  onConfirm,
  confirming,
  error,
}: {
  clientName: string;
  proposedDate: string;
  totalEquipmentCount: number;
  technicians: Technician[];
  onCancel: () => void;
  onConfirm: (assignedTechnicianId: string | null) => void;
  confirming: boolean;
  error?: string;
}) {
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [loading, setLoading] = useState(true);
  const [technicianId, setTechnicianId] = useState('');

  useEffect(() => {
    setLoading(true);
    fetch(`/api/service-requests/availability?date=${proposedDate}`)
      .then((r) => r.json())
      .then(setAvailability)
      .finally(() => setLoading(false));
  }, [proposedDate]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-ink-900">Smart Scheduling</h2>

        <div className="rounded-lg bg-slate-50 p-3 text-sm">
          <p className="mb-1 text-xs font-semibold uppercase text-slate-400">System Analysis</p>
          {loading ? (
            <p className="text-slate-500">Checking capacity for {proposedDate}…</p>
          ) : availability ? (
            <p className={availability.available ? 'text-emerald-700' : 'text-red-700'}>
              {availability.booked}/{availability.capacity} teams already booked on this date —{' '}
              {availability.available ? `${availability.remaining} team(s) available.` : 'fully booked. You can still proceed to overbook.'}
            </p>
          ) : (
            <p className="text-slate-500">Could not check availability.</p>
          )}
        </div>

        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">Client Name</dt>
            <dd className="font-medium text-ink-900">{clientName}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Scheduled Date</dt>
            <dd className="font-medium text-ink-900">{proposedDate}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Total Equipment Count</dt>
            <dd className="font-medium text-ink-900">{totalEquipmentCount}</dd>
          </div>
        </dl>

        <div>
          <label className="label">Team Assignment</label>
          <select className="input" value={technicianId} onChange={(e) => setTechnicianId(e.target.value)}>
            <option value="">Auto-assign — leave unassigned for dispatch to pick</option>
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={confirming}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={() => onConfirm(technicianId || null)} disabled={confirming}>
            {confirming ? 'Scheduling…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
