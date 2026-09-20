'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ConvertToWorkOrderButton({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function convert() {
    setLoading(true);
    try {
      const res = await fetch(`/api/service-requests/${id}/convert`, { method: 'POST' });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button className="text-xs font-medium text-brand-700 hover:underline" onClick={convert} disabled={loading}>
      {loading ? 'Scheduling…' : 'Create Work Order →'}
    </button>
  );
}
