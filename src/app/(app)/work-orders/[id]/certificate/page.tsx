import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { loadCertificateData } from '@/lib/certificate';
import CertificateDocument from '@/components/work-orders/certificate-document';
import PrintButton from '@/components/print-button';
import { DownloadCertificateButton, IssueCertificateButton } from '@/components/work-orders/certificate-actions';

export default async function CertificatePage({ params }: { params: { id: string } }) {
  const wo = await prisma.workOrder.findUnique({
    where: { id: params.id },
    select: { id: true, woNumber: true, status: true, certificateNumber: true, customer: { select: { displayName: true } } },
  });
  if (!wo) notFound();
  const data = wo.certificateNumber ? await loadCertificateData(wo.id) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Servicing certificate</h1>
          <p className="text-sm text-slate-500">
            {wo.woNumber} · {wo.customer.displayName}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/work-orders/${wo.id}`} className="btn-secondary">← Work order</Link>
          {data && (
            <>
              <PrintButton />
              <DownloadCertificateButton data={data} />
            </>
          )}
        </div>
      </div>

      {data ? (
        <div className="print-area">
          <CertificateDocument data={data} />
        </div>
      ) : wo.status === 'COMPLETED' ? (
        <div className="card p-6">
          <p className="mb-4 text-sm text-slate-600">No certificate has been issued for this job yet. Issuing it numbers the certificate, updates the last-service date of the equipment inspected, and records the job as a servicing batch.</p>
          <IssueCertificateButton workOrderId={wo.id} />
        </div>
      ) : (
        <div className="card p-6 text-sm text-slate-500">A certificate can be issued once the work order is completed.</div>
      )}
    </div>
  );
}
