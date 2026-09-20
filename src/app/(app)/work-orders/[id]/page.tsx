import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { StatusBadge } from '@/components/status-badge';
import AssignTechnicianForm from '@/components/work-orders/assign-technician-form';

export default async function WorkOrderDetailPage({ params }: { params: { id: string } }) {
  const [wo, technicians] = await Promise.all([
    prisma.workOrder.findUnique({
      where: { id: params.id },
      include: {
        customer: true,
        site: true,
        assignedTechnician: true,
        inspectionItems: true,
        invoice: true,
        serviceRequest: true,
      },
    }),
    prisma.user.findMany({ where: { role: 'TECHNICIAN', active: true } }),
  ]);
  if (!wo) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">{wo.woNumber}</h1>
          <div className="mt-1 flex items-center gap-2">
            <StatusBadge status={wo.status} />
            <span className="text-sm text-slate-500">{wo.customer.displayName}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {wo.status !== 'COMPLETED' && wo.status !== 'CANCELLED' && (
            <Link href={`/technician/${wo.id}`} className="btn-secondary">
              Open in POS →
            </Link>
          )}
          {wo.status === 'COMPLETED' && !wo.invoice && (
            <Link href={`/billing/invoices/new?workOrderId=${wo.id}`} className="btn-primary">
              Convert to Draft Invoice
            </Link>
          )}
          {wo.invoice && (
            <Link href={`/billing/invoices/${wo.invoice.id}`} className="btn-secondary">
              View Invoice {wo.invoice.invoiceNumber}
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card space-y-2 p-6 lg:col-span-2">
          <h2 className="text-sm font-semibold text-ink-900">Job Details</h2>
          <p className="text-sm text-slate-600">
            <span className="font-medium">Type:</span> {wo.serviceType === 'ONSITE' ? 'Onsite' : 'Workshop'}
          </p>
          <p className="text-sm text-slate-600">
            <span className="font-medium">Scheduled:</span>{' '}
            {wo.scheduledDate ? wo.scheduledDate.toLocaleDateString() : '—'}
          </p>
          <p className="text-sm text-slate-600">
            <span className="font-medium">Region:</span> {wo.region ?? '—'}
          </p>
          <p className="text-sm text-slate-600">
            <span className="font-medium">Location:</span> {wo.locationDetails ?? '—'}
          </p>
          {wo.serviceRequest && (
            <p className="text-sm text-slate-600">
              <span className="font-medium">Source Request:</span> {wo.serviceRequest.requestNumber}
            </p>
          )}
        </div>
        <div className="card space-y-3 p-6">
          <h2 className="text-sm font-semibold text-ink-900">Assignment</h2>
          <AssignTechnicianForm workOrderId={wo.id} technicians={technicians} currentTechnicianId={wo.assignedTechnicianId} />
        </div>
      </div>

      {wo.status === 'COMPLETED' && Array.isArray(wo.serviceLines) && (wo.serviceLines as any[]).length > 0 && (
        <div className="card p-6">
          <h2 className="mb-3 text-sm font-semibold text-ink-900">Service Items Logged (Mobile POS)</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-500">
                <th className="py-2">Item</th>
                <th className="py-2">Type</th>
                <th className="py-2 text-right">Qty</th>
              </tr>
            </thead>
            <tbody>
              {(wo.serviceLines as any[]).map((l: any) => (
                <tr key={l.key} className="border-t border-slate-100">
                  <td className="py-2">{l.label}</td>
                  <td className="py-2 text-slate-500">{l.kind}</td>
                  <td className="py-2 text-right">{l.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-slate-500">
            Total units affected: {(wo.serviceLines as any[]).reduce((s: number, l: any) => s + l.quantity, 0)}
            {wo.invoiceNumberIfIssued && ` · Invoice #: ${wo.invoiceNumberIfIssued}`}
          </p>
        </div>
      )}

      {wo.status === 'COMPLETED' && (
        <div className="card p-6">
          <h2 className="mb-3 text-sm font-semibold text-ink-900">Inspection Log</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-500">
                <th className="py-2">Category</th>
                <th className="py-2">Serial #</th>
                <th className="py-2">Result</th>
                <th className="py-2">Replacement Parts</th>
                <th className="py-2">Hydrostatic</th>
              </tr>
            </thead>
            <tbody>
              {wo.inspectionItems.map((item) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="py-2">{item.category.replace(/_/g, ' ')}</td>
                  <td className="py-2 text-slate-500">{item.serialNumber ?? '—'}</td>
                  <td className="py-2">
                    <StatusBadge status={item.passFail} />
                  </td>
                  <td className="py-2 text-slate-500">{item.replacementParts ?? '—'}</td>
                  <td className="py-2 text-slate-500">{item.hydrostaticTestDone ? item.hydrostaticNotes || 'Done' : '—'}</td>
                </tr>
              ))}
              {wo.inspectionItems.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400">
                    No inspection entries logged.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {wo.customerSignatureDataUrl && (
            <div className="mt-6 border-t border-slate-100 pt-4">
              <p className="mb-2 text-xs font-semibold uppercase text-slate-500">
                Customer Sign-off — {wo.customerSignedName}
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={wo.customerSignatureDataUrl}
                alt="Customer signature"
                className="h-24 rounded border border-slate-200 bg-white"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
