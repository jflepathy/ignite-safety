'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Technician = { id: string; name: string };

export default function AssignTechnicianForm({
  workOrderId,
  technicians,
  currentTechnicianId,
}: {
  workOrderId: string;
  technicians: Technician[];
  currentTechnicianId: string | null;
}) {
  const router = useRouter();
  const [technicianId, setTechnicianId] = useState(currentTechnicianId ?? '');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await fetch(`/api/work-orders/${workOrderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignedTechnicianId: technicianId || null,
          status: technicianId ? 'SCHEDULED' : 'PENDING',
        }),
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <label className="label">Technician</label>
      <select className="input" value={technicianId} onChange={(e) => setTechnicianId(e.target.value)}>
        <option value="">Unassigned</option>
        {technicians.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <button className="btn-secondary w-full" onClick={save} disabled={saving}>
        {saving ? 'Saving…' : 'Save Assignment'}
      </button>
    </div>
  );
}
