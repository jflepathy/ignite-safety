'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RebuildLedgerButton({ parts }: { parts: string[][] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState('');

  async function run() {
    setBusy(true);
    setError('');
    setLog([]);
    try {
      for (const p of parts) {
        const res = await fetch(`/api/accounting/ledger/rebuild?types=${p.join(',')}`, { method: 'POST' });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.ok) throw new Error(body.error ?? `Failed on ${p.join(', ')}`);
        setLog((l) => [...l, ...body.result.map((r: any) => `${r.type.replace(/_/g, ' ').toLowerCase()}: ${r.entries} entries`)]);
      }
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <button type="button" className="btn-primary" disabled={busy} onClick={run}>
        {busy ? 'Rebuilding…' : 'Rebuild ledger now'}
      </button>
      {log.length > 0 && <p className="text-xs text-slate-500">{log.join(' · ')}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
