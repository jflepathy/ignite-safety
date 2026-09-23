'use client';

/** WhatsApp / email "send this invoice to the client" links for the
 * technician billing bridge (Session 16) — plain wa.me / mailto deep
 * links, no messaging API integration needed. */
export default function ShareInvoiceButtons({
  sharePath,
  customerName,
  customerPhone,
  customerEmail,
  invoiceNumber,
  companyName,
}: {
  sharePath: string;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  invoiceNumber: string;
  companyName: string;
}) {
  const url = typeof window !== 'undefined' ? `${window.location.origin}${sharePath}` : sharePath;
  const message = `Hi ${customerName}, here's your invoice ${invoiceNumber} from ${companyName}: ${url}`;
  const waPhone = customerPhone ? customerPhone.replace(/[^\d+]/g, '') : '';
  const waHref = `https://wa.me/${waPhone.replace(/^\+/, '')}?text=${encodeURIComponent(message)}`;
  const mailHref = `mailto:${customerEmail ?? ''}?subject=${encodeURIComponent(`Invoice ${invoiceNumber} from ${companyName}`)}&body=${encodeURIComponent(message)}`;

  return (
    <div className="grid grid-cols-2 gap-2">
      <a
        href={waPhone ? waHref : undefined}
        target="_blank"
        rel="noreferrer"
        className={`btn-secondary flex items-center justify-center gap-1.5 py-2.5 text-sm ${!waPhone ? 'pointer-events-none opacity-40' : ''}`}
        title={waPhone ? undefined : 'No phone number on file for this customer'}
      >
        🟢 WhatsApp
      </a>
      <a
        href={customerEmail ? mailHref : undefined}
        className={`btn-secondary flex items-center justify-center gap-1.5 py-2.5 text-sm ${!customerEmail ? 'pointer-events-none opacity-40' : ''}`}
        title={customerEmail ? undefined : 'No email on file for this customer'}
      >
        ✉️ Email
      </a>
    </div>
  );
}
