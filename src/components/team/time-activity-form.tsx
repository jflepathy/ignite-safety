'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Option = { id: string; name: string };

export default function TimeActivityForm({ employees, customers }: { employees: Option[]; customers: Option[] }) {
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? '');
  const [customerId, setCustomerId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [hours, setHours] = useState(1);
  const [billable, setBillable] = useState(true);
  const [serviceDescription, setServiceDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/time-activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId,
          customerId: customerId || undefined,
          date,
          hours,
          billable,
          serviceDescription: serviceDescription || undefined,
          notes: notes || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ? JSON.stringify(body.error) : 'Failed to save');
      }
      router.push('/team/time-tracking');
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card grid max-w-xl grid-cols-1 gap-4 p-6">
      <div>
        <label className="label">Employee</label>
        <select className="input" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Customer (optional)</label>
        <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
          <option value="">—</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Date</label>
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="label">Hours</label>
          <input
            type="number"
            step="0.25"
            className="input"
            value={hours}
            onChange={(e) => setHours(parseFloat(e.target.value) || 0)}
          />
        </div>
      </div>
      <div>
        <label className="label">Service Description</label>
        <input className="input" value={serviceDescription} onChange={(e) => setServiceDescription(e.target.value)} />
      </div>
      <div>
        <label className="label">Notes</label>
        <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <label className="flex items-center gap-2 text-sm text-ink-900">
        <input type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} />
        Billable
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end">
        <button className="btn-primary" disabled={submitting || !employeeId} onClick={submit}>
          {submitting ? 'Saving…' : 'Save Time Activity'}
        </button>
      </div>
    </div>
  );
}
