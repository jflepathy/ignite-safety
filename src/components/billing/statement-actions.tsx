'use client';

import { useState } from 'react';
import type { StatementData } from '@/lib/statement';

export function DownloadStatementButton({ data, fileName }: { data: StatementData; fileName: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn-secondary"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const { buildStatementPdf } = await import('@/lib/pdf/build-statement-pdf');
          buildStatementPdf(data).save(`${fileName}.pdf`);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? 'Preparing…' : '⬇ Download PDF'}
    </button>
  );
}

export function EmailStatementButton({ customerId, from, to, email }: { customerId: string; from: string; to: string; email: string | null }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [err, setErr] = useState('');
  if (!email) return <span className="text-xs text-slate-400">No email on file</span>;
  return (
    <div className="inline-flex flex-col items-end">
      <button
        className="btn-secondary"
        disabled={state === 'sending'}
        onClick={async () => {
          setState('sending');
          setErr('');
          const res = await fetch(`/api/customers/${customerId}/statement/email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: from || null, to: to || null }),
          });
          if (res.ok) setState('sent');
          else {
            setState('idle');
            setErr((await res.json().catch(() => ({}))).error || 'Could not send.');
          }
        }}
      >
        {state === 'sending' ? 'Sending…' : state === 'sent' ? '✓ Sent' : `✉ Email to ${email}`}
      </button>
      {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
    </div>
  );
}
