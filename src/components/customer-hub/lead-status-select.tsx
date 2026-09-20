'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { StatusBadge } from '@/components/status-badge';

export default function LeadStatusSelect({ leadId, status, options }: { leadId: string; status: string; options: string[] }) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [saving, setSaving] = useState(false);

  async function update(next: string) {
    setValue(next);
    setSaving(true);
    try {
      await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
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
      <StatusBadge status={value} />
    </div>
  );
}
