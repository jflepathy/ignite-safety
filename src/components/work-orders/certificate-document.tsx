import type { CertificateData } from '@/lib/certificate';

/** A4 servicing certificate, in the same plain look as the invoice. */
export default function CertificateDocument({ data }: { data: CertificateData }) {
  const s = data.settings;
  return (
    <div className="bg-white text-ink-900" style={{ fontFamily: '"Courier New", Courier, monospace' }}>
      <div className="flex items-start justify-between gap-6 border-b border-slate-100 bg-white p-8">
        <div>
          <p className="text-lg font-bold tracking-tight">{s.companyName}</p>
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-500">{s.companyAddress}</p>
          <p className="text-sm text-slate-500">{s.companyPhone}</p>
          <p className="text-sm text-slate-500">{s.companyEmail}</p>
        </div>
        {s.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.logoUrl} alt={s.companyName} className="h-24 object-contain" />
        ) : (
          <div className="flex items-center gap-2 text-2xl font-bold tracking-wide">
            <span className="text-brand-600">{s.companyName.split(' ')[0]?.toUpperCase()}</span>
            <span className="h-8 w-px bg-slate-300" />
            <span className="text-ink-900">{s.companyName.split(' ').slice(1).join(' ').toUpperCase()}</span>
          </div>
        )}
      </div>

      <div className="p-8">
        <div className="mb-6 flex items-start justify-between border-b-2 border-ink-900 pb-4">
          <div>
            <p className="text-2xl font-bold uppercase tracking-wide">Certificate of Servicing</p>
            <p className="text-sm text-slate-500">Fire safety equipment</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Certificate No.</p>
            <p className="text-lg font-bold text-brand-600">{data.certificateNumber}</p>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-6 text-sm">
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Customer</p>
            <p className="font-semibold">{data.customer.displayName}</p>
            <p className="whitespace-pre-line text-slate-500">{data.customer.address}</p>
            <p className="text-slate-500">{data.customer.phone}</p>
            {data.siteAddress && (
              <p className="mt-2 text-slate-600">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Site: </span>
                {data.siteAddress}
              </p>
            )}
          </div>
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 self-start justify-self-end text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Service date</span>
            <span className="font-medium">{data.serviceDate}</span>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Next due</span>
            <span className="font-bold text-brand-600">{data.nextDueDate}</span>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Work order</span>
            <span className="font-medium">{data.workOrderNumber}</span>
            {data.invoiceNumber && (
              <>
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Invoice</span>
                <span className="font-medium">{data.invoiceNumber}</span>
              </>
            )}
          </div>
        </div>

        {data.items.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-ink-900 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-2">#</th>
                <th className="py-2 pr-2">Equipment</th>
                <th className="py-2 pr-2">Serial No.</th>
                <th className="py-2 pr-2">Location</th>
                <th className="py-2 pr-2">Result</th>
                <th className="py-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((it) => (
                <tr key={it.no} className="border-b border-slate-100 align-top">
                  <td className="py-1.5 pr-2">{it.no}</td>
                  <td className="py-1.5 pr-2">{it.type}</td>
                  <td className="py-1.5 pr-2">{it.serial || '—'}</td>
                  <td className="py-1.5 pr-2">{it.location || '—'}</td>
                  <td className={`py-1.5 pr-2 font-bold ${it.result === 'FAIL' ? 'text-red-600' : ''}`}>{it.result}</td>
                  <td className="py-1.5 text-slate-600">{it.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}

        {data.summary.length > 0 && (
          <div className={data.items.length ? 'mt-6' : ''}>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {data.items.length ? 'Other items serviced' : 'Items serviced'}
            </p>
            <table className="w-full text-sm">
              <tbody>
                {data.summary.map((l, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-1.5 pr-2">{l.label}</td>
                    <td className="py-1.5 text-right">{l.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data.technicianNotes && (
          <p className="mt-4 text-sm text-slate-600">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Remarks: </span>
            {data.technicianNotes}
          </p>
        )}

        <p className="mt-6 text-xs leading-relaxed text-slate-600">{data.declaration}</p>

        <div className="mt-10 grid grid-cols-2 gap-10 text-sm">
          <div>
            <div className="h-16 border-b border-ink-900">
              {data.customerSignatureDataUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.customerSignatureDataUrl} alt="Customer signature" className="h-16 object-contain" />
              )}
            </div>
            <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">Customer</p>
            <p className="font-medium">{data.customerSignedName ?? ''}</p>
          </div>
          <div>
            <div className="h-16 border-b border-ink-900" />
            <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">Technician signature</p>
            <p className="font-medium">{data.technicians.join(', ')}</p>
          </div>
        </div>
        {s.taxRegistrationNumber && <p className="mt-8 text-xs text-slate-500">TIN: {s.taxRegistrationNumber}</p>}
      </div>
    </div>
  );
}
