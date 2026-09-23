'use client';

/** WhatsApp / email "send this invoice to the client" links for the
 * technician billing bridge (Session 16) — plain wa.me / mailto deep
 * links, no messaging API integration needed.
 *
 * Customer phone numbers in this database are stored as plain local
 * Seychelles numbers (e.g. "2512345"), sometimes with a second number or a
 * "Mobile:" label on a following line (e.g. "2857425\nMobile: 2815586").
 * wa.me requires the full international number with no leading 0 — a bare
 * local number, or the two numbers run together with the letters stripped
 * out, both produce an invalid link that silently does nothing when
 * tapped. normalizeForWhatsApp() takes just the first phone number found
 * and prefixes it with Seychelles' country code (248) when it isn't
 * already there. */
function normalizeForWhatsApp(raw: string): string {
  const firstToken = raw.split(/\r?\n/)[0]; // ignore a second "Mobile: ..." line, if any
  const digits = firstToken.replace(/[^\d+]/g, '').replace(/^\+/, '');
  if (!digits) return '';
  if (digits.startsWith('248') && digits.length > 7) return digits;
  return `248${digits.replace(/^0+/, '')}`;
}

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
  const waPhone = customerPhone ? normalizeForWhatsApp(customerPhone) : '';
  const waHref = `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`;
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
