'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function AutoMatchButton({ bankAccountId }: { bankAccountId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        className="btn-secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const res = await fetch('/api/reconcile/auto', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bankAccountId }),
          });
          const b = await res.json().catch(() => ({}));
          setBusy(false);
          setMsg(res.ok ? `${b.matched} matched` : 'Failed');
          router.refresh();
        }}
      >
        {busy ? 'Matching…' : 'Auto-match'}
      </button>
      {msg && <span className="text-xs text-slate-500">{msg}</span>}
    </span>
  );
}

export function UndoImportButton({ importId }: { importId: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!confirm)
    return (
      <button type="button" className="text-xs text-slate-400 hover:text-red-600 hover:underline" onClick={() => setConfirm(true)}>
        Remove
      </button>
    );
  return (
    <span className="inline-flex items-center gap-2 text-xs">
      <span className="text-slate-600">Remove this import&apos;s lines?</span>
      <button
        type="button"
        className="font-medium text-red-600 hover:underline"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await fetch(`/api/bank-statements/${importId}`, { method: 'DELETE' });
          setBusy(false);
          setConfirm(false);
          router.refresh();
        }}
      >
        {busy ? '…' : 'Yes'}
      </button>
      <button type="button" className="text-slate-500 hover:underline" onClick={() => setConfirm(false)}>
        No
      </button>
    </span>
  );
}
