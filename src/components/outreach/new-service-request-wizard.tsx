'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { REGIONS, REGION_DISTRICTS } from '@/lib/regions';
import SmartSchedulingModal from './smart-scheduling-modal';

type Customer = {
  id: string;
  displayName: string;
  phone: string | null;
  contactPerson?: string | null;
  region: string | null;
  district?: string | null;
};
type Technician = { id: string; name: string };

// The five equipment counters the Servicing Request wizard tracks, exactly
// as specified: Fire Extinguishers, Fire Blankets, Hose Reels, Suppression
// Systems, Others. (The full EquipmentCategory enum has more granular
// types — smoke detectors, alarm panels, etc — used elsewhere for actual
// equipment records; this wizard only needs the five tentative counters.)
const COUNTERS: { value: 'FIRE_EXTINGUISHER' | 'FIRE_BLANKET' | 'HOSE_REEL' | 'SUPPRESSION_SYSTEM' | 'OTHER'; label: string }[] = [
  { value: 'FIRE_EXTINGUISHER', label: 'Fire Extinguishers' },
  { value: 'FIRE_BLANKET', label: 'Fire Blankets' },
  { value: 'HOSE_REEL', label: 'Hose Reels' },
  { value: 'SUPPRESSION_SYSTEM', label: 'Suppression Systems' },
  { value: 'OTHER', label: 'Others' },
];

export default function NewServiceRequestWizard({
  customers,
  technicians,
  onClose,
  initialCustomerId,
  initialSourceEquipmentId,
}: {
  customers: Customer[];
  technicians: Technician[];
  onClose: () => void;
  initialCustomerId?: string;
  initialSourceEquipmentId?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);

  const [customerList, setCustomerList] = useState(customers);
  const [search, setSearch] = useState('');
  const [customerId, setCustomerId] = useState(initialCustomerId ?? '');
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ displayName: '', phone: '', contactPerson: '', region: '', district: '' });
  const [creatingCustomer, setCreatingCustomer] = useState(false);

  const [serviceType, setServiceType] = useState<'ONSITE' | 'WORKSHOP'>('ONSITE');
  const [proposedDate, setProposedDate] = useState('');
  const [region, setRegion] = useState('');
  const [district, setDistrict] = useState('');
  const [buildingName, setBuildingName] = useState('');
  const [locationNotes, setLocationNotes] = useState('');

  const [counts, setCounts] = useState<Record<string, number>>({});

  const [showScheduling, setShowScheduling] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [schedulingError, setSchedulingError] = useState('');

  const selectedCustomer = customerList.find((c) => c.id === customerId);
  const totalEquipmentCount = Object.values(counts).reduce((s, n) => s + (n || 0), 0);

  const filteredCustomers = customerList.filter(
    (c) => !search || c.displayName.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search)
  );

  useEffect(() => {
    if (customerId && !region) {
      const c = customerList.find((c) => c.id === customerId);
      if (c?.region) setRegion(c.region);
      if (c?.district) setDistrict(c.district);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  function incCounter(key: string, delta: number) {
    setCounts((prev) => ({ ...prev, [key]: Math.max(0, (prev[key] ?? 0) + delta) }));
  }

  async function createCustomerInline() {
    if (!newCustomer.displayName) return;
    setCreatingCustomer(true);
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCustomer),
      });
      if (res.ok) {
        const created = await res.json();
        setCustomerList((prev) => [...prev, created].sort((a, b) => a.displayName.localeCompare(b.displayName)));
        setCustomerId(created.id);
        setShowNewCustomer(false);
        setNewCustomer({ displayName: '', phone: '', contactPerson: '', region: '', district: '' });
      }
    } finally {
      setCreatingCustomer(false);
    }
  }

  async function confirmSchedule(assignedTechnicianId: string | null) {
    setScheduling(true);
    setSchedulingError('');
    try {
      const createRes = await fetch('/api/service-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          serviceType,
          proposedDate,
          region,
          district,
          locationDetails: [buildingName && `Building/House: ${buildingName}`, locationNotes].filter(Boolean).join('\n'),
          sourceEquipmentId: initialSourceEquipmentId ?? null,
          equipmentCounts: Object.entries(counts).map(([category, tentativeCount]) => ({ category, tentativeCount })),
        }),
      });
      if (!createRes.ok) throw new Error('Failed to create the servicing request.');
      const { serviceRequest } = await createRes.json();

      // Immediately hand off to Work Orders — this is the fix for
      // servicing requests that used to sit un-convertible after creation.
      const convertRes = await fetch(`/api/service-requests/${serviceRequest.id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedTechnicianId }),
      });
      if (!convertRes.ok) throw new Error('Servicing request was created, but could not be generated into a Work Order.');
      const workOrder = await convertRes.json();

      onClose();
      router.push(`/work-orders/${workOrder.id}`);
      router.refresh();
    } catch (e: any) {
      setSchedulingError(e.message);
    } finally {
      setScheduling(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <h2 className="text-lg font-semibold text-ink-900">New Servicing Request</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-ink-800">
            ✕
          </button>
        </div>

        <div className="flex gap-2 px-6 pt-4">
          {['Client', 'Logistics', 'Equipment', 'Review'].map((label, idx) => (
            <div
              key={label}
              className={`flex-1 rounded-full py-1 text-center text-xs font-medium ${
                step === idx + 1 ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {idx + 1}. {label}
            </div>
          ))}
        </div>

        <div className="space-y-4 px-6 py-6">
          {step === 1 && (
            <div className="space-y-3">
              <label className="label">Name of Client / Company</label>
              <input
                className="input"
                placeholder="Search by name or phone…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="max-h-56 space-y-1 overflow-y-auto">
                {filteredCustomers.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setCustomerId(c.id)}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ${
                      customerId === c.id ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span>{c.displayName}</span>
                    <span className="text-xs text-slate-500">{c.phone ?? '—'}</span>
                  </button>
                ))}
                {filteredCustomers.length === 0 && (
                  <p className="py-4 text-center text-sm text-slate-400">No matching clients.</p>
                )}
              </div>

              {selectedCustomer && (
                <div className="rounded-lg bg-slate-50 p-3 text-sm">
                  <p className="text-xs font-semibold uppercase text-slate-400">Auto-populated from client record</p>
                  <p>
                    <span className="text-slate-500">Contact Person:</span>{' '}
                    <span className="font-medium text-ink-900">{selectedCustomer.contactPerson || '—'}</span>
                  </p>
                  <p>
                    <span className="text-slate-500">Phone Number:</span>{' '}
                    <span className="font-medium text-ink-900">{selectedCustomer.phone || '—'}</span>
                  </p>
                </div>
              )}

              {!showNewCustomer ? (
                <button type="button" className="text-sm font-medium text-brand-700 hover:underline" onClick={() => setShowNewCustomer(true)}>
                  + Create new customer
                </button>
              ) : (
                <div className="space-y-2 rounded-lg border border-slate-200 p-3">
                  <p className="text-xs font-semibold uppercase text-slate-400">New Customer</p>
                  <input
                    className="input"
                    placeholder="Client / Company name *"
                    value={newCustomer.displayName}
                    onChange={(e) => setNewCustomer({ ...newCustomer, displayName: e.target.value })}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      className="input"
                      placeholder="Contact person"
                      value={newCustomer.contactPerson}
                      onChange={(e) => setNewCustomer({ ...newCustomer, contactPerson: e.target.value })}
                    />
                    <input
                      className="input"
                      placeholder="Phone number"
                      value={newCustomer.phone}
                      onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button type="button" className="btn-secondary" onClick={() => setShowNewCustomer(false)}>
                      Cancel
                    </button>
                    <button type="button" className="btn-primary" disabled={creatingCustomer || !newCustomer.displayName} onClick={createCustomerInline}>
                      {creatingCustomer ? 'Saving…' : 'Save & Select'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="label">Service Type</label>
                  <div className="flex gap-2">
                    {(['ONSITE', 'WORKSHOP'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setServiceType(t)}
                        className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
                          serviceType === t ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600'
                        }`}
                      >
                        {t === 'ONSITE' ? 'Onsite' : 'Workshop'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="label">Region</label>
                  <select
                    className="input"
                    value={region}
                    onChange={(e) => {
                      setRegion(e.target.value);
                      setDistrict('');
                    }}
                  >
                    <option value="">Select region…</option>
                    {REGIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">District</label>
                  <select className="input" value={district} onChange={(e) => setDistrict(e.target.value)} disabled={!region}>
                    <option value="">Select district…</option>
                    {(REGION_DISTRICTS[region] ?? []).map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="label">Proposed Date</label>
                <input type="date" className="input" value={proposedDate} onChange={(e) => setProposedDate(e.target.value)} />
              </div>

              <div>
                <label className="label">Building / House Name</label>
                <input
                  className="input"
                  value={buildingName}
                  onChange={(e) => setBuildingName(e.target.value)}
                  placeholder="e.g. Hart Building"
                />
              </div>
              <div>
                <label className="label">Additional Location Details</label>
                <textarea
                  className="input"
                  rows={2}
                  value={locationNotes}
                  onChange={(e) => setLocationNotes(e.target.value)}
                  placeholder="Floor, access instructions…"
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">Tentative equipment counts</p>
                <p className="text-sm font-semibold text-ink-900">Total: {totalEquipmentCount}</p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {COUNTERS.map((c) => (
                  <div key={c.value} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                    <span className="text-sm">{c.label}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 text-sm font-medium hover:bg-slate-50"
                        onClick={() => incCounter(c.value, -1)}
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-sm font-medium">{counts[c.value] ?? 0}</span>
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 text-sm font-medium hover:bg-slate-50"
                        onClick={() => incCounter(c.value, 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-2 text-sm">
              <p>
                <span className="font-medium">Client:</span> {selectedCustomer?.displayName}
              </p>
              <p>
                <span className="font-medium">Type:</span> {serviceType}
              </p>
              <p>
                <span className="font-medium">Proposed Date:</span> {proposedDate || '—'}
              </p>
              <p>
                <span className="font-medium">Region / District:</span> {region || '—'} {district && `/ ${district}`}
              </p>
              <p>
                <span className="font-medium">Building / House Name:</span> {buildingName || '—'}
              </p>
              <div>
                <span className="font-medium">Equipment (Total {totalEquipmentCount}):</span>
                <ul className="mt-1 list-inside list-disc text-slate-600">
                  {COUNTERS.filter((c) => (counts[c.value] ?? 0) > 0).map((c) => (
                    <li key={c.value}>
                      {c.label}: {counts[c.value]}
                    </li>
                  ))}
                  {totalEquipmentCount === 0 && <li>None entered</li>}
                </ul>
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 flex items-center justify-between border-t border-slate-200 bg-white px-6 py-4">
          <button className="btn-secondary" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1}>
            Back
          </button>
          {step < 4 ? (
            <button className="btn-primary" disabled={step === 1 && !customerId} onClick={() => setStep((s) => s + 1)}>
              Next
            </button>
          ) : (
            <button className="btn-primary" disabled={!proposedDate} onClick={() => setShowScheduling(true)}>
              Check Availability &amp; Schedule
            </button>
          )}
        </div>
      </div>

      {showScheduling && selectedCustomer && (
        <SmartSchedulingModal
          clientName={selectedCustomer.displayName}
          proposedDate={proposedDate}
          totalEquipmentCount={totalEquipmentCount}
          technicians={technicians}
          confirming={scheduling}
          error={schedulingError}
          onCancel={() => setShowScheduling(false)}
          onConfirm={confirmSchedule}
        />
      )}
    </div>
  );
}
