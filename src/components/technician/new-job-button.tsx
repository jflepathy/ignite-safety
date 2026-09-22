'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import CustomerCombobox, { CustomerOption } from '@/components/shared/customer-combobox';

/**
 * Lets a technician start a Work Order themselves for a job they're doing
 * on site that the office never pre-scheduled — picks (or creates) a
 * customer, then drops straight into the same POS job screen, already
 * assigned to them and In Progress (Session 11).
 */
export default function NewJobButton({
  customers,
  workshopAddress,
}: {
  customers: CustomerOption[];
  /** Company address, shown (and auto-used as the location) when Workshop
   * is selected — no need to type where a workshop job happens, it's
   * always here (Session 12). */
  workshopAddress?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [customerOptions, setCustomerOptions] = useState(customers);
  const [customerId, setCustomerId] = useState('');
  const [serviceType, setServiceType] = useState<'ONSITE' | 'WORKSHOP'>('ONSITE');
  const [locationDetails, setLocationDetails] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function create() {
    if (!customerId) {
      setError('Pick or add a customer first.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/work-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          serviceType,
          locationDetails: serviceType === 'WORKSHOP' ? workshopAddress || 'Ignite Safety Workshop' : locationDetails || undefined,
          region: serviceType === 'WORKSHOP' ? 'Mahe' : undefined,
        }),
      });
      if (!res.ok) throw new Error('Could not create the job.');
      const wo = await res.json();
      router.push(`/technician/${wo.id}`);
    } catch (e: any) {
      setError(e.message);
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn-primary w-full py-3 text-base" onClick={() => setOpen(true)}>
        + New Job (On Site)
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="w-full max-w-md space-y-3 rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl">
        <h2 className="text-lg font-semibold text-ink-900">New Job</h2>
        <CustomerCombobox
          customers={customerOptions}
          value={customerId}
          onChange={setCustomerId}
          onCreated={(c) => {
            setCustomerOptions((prev) => [...prev, c]);
            setCustomerId(c.id);
          }}
        />
        <div>
          <label className="label">Service Type</label>
          <select className="input" value={serviceType} onChange={(e) => setServiceType(e.target.value as 'ONSITE' | 'WORKSHOP')}>
            <option value="ONSITE">Onsite</option>
            <option value="WORKSHOP">Workshop</option>
          </select>
        </div>
        {serviceType === 'WORKSHOP' ? (
          <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
            📍 At Ignite Safety&apos;s workshop — {workshopAddress || 'no workshop address set in Admin Settings'}. No need to enter a location.
          </p>
        ) : (
          <div>
            <label className="label">Location (optional)</label>
            <input
              className="input"
              value={locationDetails}
              onChange={(e) => setLocationDetails(e.target.value)}
              placeholder="e.g. Building name / area"
            />
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="btn-primary" disabled={saving || !customerId} onClick={create}>
            {saving ? 'Starting…' : 'Start Job'}
          </button>
        </div>
      </div>
    </div>
  );
}
