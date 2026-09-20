'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { StatusBadge } from '@/components/status-badge';

const STAGE_COLORS: Record<string, string> = {
  PROSPECTING: 'bg-slate-100 text-slate-700',
  QUALIFICATION: 'bg-blue-100 text-blue-700',
  PROPOSAL: 'bg-amber-100 text-amber-700',
  NEGOTIATION: 'bg-amber-100 text-amber-700',
  WON: 'bg-emerald-100 text-emerald-700',
  LOST: 'bg-red-100 text-red-700',
};

export default function OpportunityStageSelect({ opportunityId, stage, options }: { opportunityId: string; stage: string; options: string[] }) {
  const router = useRouter();
  const [value, setValue] = useState(stage);
  const [saving, setSaving] = useState(false);

  async function update(next: string) {
    setValue(next);
    setSaving(true);
    try {
      await fetch(`/api/opportunities/${opportunityId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: next }),
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <select
        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
        value={value}
        disabled={saving}
        onChange={(e) => update(e.target.value)}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <span className={`badge ${STAGE_COLORS[value] ?? 'bg-slate-100 text-slate-700'}`}>{value}</span>
    </div>
  );
}
