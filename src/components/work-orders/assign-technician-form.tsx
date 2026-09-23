'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Technician = { id: string; name: string };

// Session 20: an admin can put more than one technician on a job -- the
// primary Technician dropdown (as before) plus a checklist of additional
// technicians. Whatever incentive the job earns is split equally across
// everyone on it (primary + additional) -- see src/lib/incentives.ts and
// the technician Incentive tab.
export default function AssignTechnicianForm({
  workOrderId,
  technicians,
  currentTechnicianId,
  currentAdditionalTechnicianIds,
}: {
  workOrderId: string;
  technicians: Technician[];
  currentTechnicianId: string | null;
  currentAdditionalTechnicianIds: string[];
}) {
  const router = useRouter();
  const [technicianId, setTechnicianId] = useState(currentTechnicianId ?? '');
  const [additionalIds, setAdditionalIds] = useState<string[]>(currentAdditionalTechnicianIds);
  const [saving, setSaving] = useState(false);

  function toggleAdditional(id: string) {
    setAdditionalIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function save() {
    setSaving(true);
    try {
      // The primary can't also be listed as an additional technician —
      // drop it from the set being saved if it's there (e.g. the admin
      // picked someone as primary after already checking them below).
      const cleanedAdditional = additionalIds.filter((id) => id !== technicianId);
      await fetch(`/api/work-orders/${workOrderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignedTechnicianId: technicianId || null,
          status: technicianId ? 'SCHEDULED' : 'PENDING',
          additionalTechnicianIds: cleanedAdditional,
        }),
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const otherTechnicians = technicians.filter((t) => t.id !== technicianId);

  return (
    <div className="space-y-3">
      <div>
        <label className="label">Technician</label>
        <select
          className="input"
          value={technicianId}
          onChange={(e) => {
            setTechnicianId(e.target.value);
            setAdditionalIds((prev) => prev.filter((id) => id !== e.target.value));
          }}
        >
          <option value="">Unassigned</option>
          {technicians.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {otherTechnicians.length > 0 && (
        <div>
          <label className="label">Additional technicians on this job</label>
          <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
            {otherTechnicians.map((t) => (
              <label key={t.id} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={additionalIds.includes(t.id)}
                  onChange={() => toggleAdditional(t.id)}
                />
                {t.name}
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            The incentive this job earns is split equally across the primary + any additional technicians checked here.
          </p>
        </div>
      )}

      <button className="btn-secondary w-full" onClick={save} disabled={saving}>
        {saving ? 'Saving…' : 'Save Assignment'}
      </button>
    </div>
  );
}
