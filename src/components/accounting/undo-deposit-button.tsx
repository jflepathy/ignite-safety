'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function UndoDepositButton({ depositId }: { depositId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function undo() {
    setBusy(true);
    setError('');
    const res = await fetch(`/api/deposits/${depositId}`, { method: 'DELETE' });
    setBusy(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b?.message ?? 'Could not undo');
      return;
    }
    setConfirming(false);
    router.refresh();
  }
  if (!confirming)
    return (
      <button type="button" className="text-xs text-slate-500 hover:text-red-600 hover:underline" onClick={() => setConfirming(true)}>
        Undo
      </button>
    );
  return (
    <span className="inline-flex items-center gap-2 text-xs">
      <span className="text-slate-500">Undo deposit?</span>
      <button type="button" className="font-medium text-red-600 hover:underline" disabled={busy} onClick={undo}>
        {busy ? '…' : 'Yes'}
      </button>
      <button type="button" className="text-slate-500 hover:underline" onClick={() => setConfirming(false)}>
        No
      </button>
      {error && <span className="text-red-600">{error}</span>}
    </span>
  );
}
