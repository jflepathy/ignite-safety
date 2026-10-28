'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CertificateData } from '@/lib/certificate';

export function IssueCertificateButton({ workOrderId }: { workOrderId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  return (
    <div>
      <button
        className="btn-primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setErr('');
          const res = await fetch(`/api/work-orders/${workOrderId}/certificate`, { method: 'POST' });
          if (res.ok) router.refresh();
          else setErr((await res.json().catch(() => ({}))).error || 'Could not issue the certificate.');
          setBusy(false);
        }}
      >
        {busy ? 'Issuing…' : 'Issue certificate'}
      </button>
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
    </div>
  );
}

export function DownloadCertificateButton({ data }: { data: CertificateData }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn-secondary"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const { buildCertificatePdf } = await import('@/lib/pdf/build-certificate-pdf');
          buildCertificatePdf(data).save(`${data.certificateNumber}.pdf`);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? 'Preparing…' : '⬇ Download PDF'}
    </button>
  );
}
