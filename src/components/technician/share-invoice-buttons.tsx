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
 * already there.
 *
 * Session 18: when the customer has no phone/email on file at all, a
 * "+ Add" button lets the technician type one in right here and save it
 * straight onto the customer record (PATCH /api/invoices/[id]/
 * technician-contact) -- previously there was simply no way to share an
 * invoice with that customer at all. */
import { useState } from 'react';
import { useRouter } from 'next/navigation';

function normalizeForWhatsApp(raw: string): string {
  const firstToken = raw.split(/\r?\n/)[0]; // ignore a second "Mobile: ..." line, if any
  const digits = firstToken.replace(/[^\d+]/g, '').replace(/^\+/, '');
  if (!digits) return '';
  if (digits.startsWith('248') && digits.length > 7) return digits;
  return `248${digits.replace(/^0+/, '')}`;
}

export default function ShareInvoiceButtons({
  invoiceId,
  sharePath,
  customerName,
  customerPhone,
  customerEmail,
  invoiceNumber,
  companyName,
}: {
  invoiceId: string;
  sharePath: string;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  invoiceNumber: string;
  companyName: string;
}) {
  const router = useRouter();
  const [phone, setPhone] = useState(customerPhone);
  const [email, setEmail] = useState(customerEmail);
  const [addingPhone, setAddingPhone] = useState(false);
  const [addingEmail, setAddingEmail] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const url = typeof window !== 'undefined' ? `${window.location.origin}${sharePath}` : sharePath;
  const message = `Hi ${customerName}, here's your invoice ${invoiceNumber} from ${companyName}: ${url}`;
  const waPhone = phone ? normalizeForWhatsApp(phone) : '';
  const waHref = `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`;
  const mailHref = `mailto:${email ?? ''}?subject=${encodeURIComponent(`Invoice ${invoiceNumber} from ${companyName}`)}&body=${encodeURIComponent(message)}`;

  async function saveContact(field: 'phone' | 'email', value: string) {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/technician-contact`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.formErrors?.[0] ?? body?.error?.fieldErrors?.[field]?.[0] ?? 'Failed to save');
      }
      if (field === 'phone') {
        setPhone(value);
        setAddingPhone(false);
      } else {
        setEmail(value);
        setAddingEmail(false);
      }
      router.refresh();
    } catch (e: any) {
      setError(e.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {phone ? (
          <a
            href={waHref}
            target="_blank"
            rel="noreferrer"
            className="btn-secondary flex items-center justify-center gap-1.5 py-2.5 text-sm"
          >
            🟢 WhatsApp
          </a>
        ) : addingPhone ? (
          <div className="col-span-2 flex gap-2">
            <input
              className="input flex-1"
              placeholder="Customer's phone number"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              inputMode="tel"
              autoFocus
            />
            <button
              type="button"
              className="btn-primary px-4 text-sm"
              disabled={saving || !phoneInput.trim()}
              onClick={() => saveContact('phone', phoneInput.trim())}
            >
              {saving ? '…' : 'Save'}
            </button>
            <button type="button" className="btn-secondary px-3 text-sm" onClick={() => setAddingPhone(false)}>
              ✕
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn-secondary flex items-center justify-center gap-1.5 py-2.5 text-sm"
            onClick={() => setAddingPhone(true)}
          >
            🟢 + Add number
          </button>
        )}

        {email ? (
          <a href={mailHref} className="btn-secondary flex items-center justify-center gap-1.5 py-2.5 text-sm">
            ✉️ Email
          </a>
        ) : addingEmail ? (
          <div className="col-span-2 flex gap-2">
            <input
              className="input flex-1"
              placeholder="Customer's email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              inputMode="email"
              autoFocus
            />
            <button
              type="button"
              className="btn-primary px-4 text-sm"
              disabled={saving || !emailInput.trim()}
              onClick={() => saveContact('email', emailInput.trim())}
            >
              {saving ? '…' : 'Save'}
            </button>
            <button type="button" className="btn-secondary px-3 text-sm" onClick={() => setAddingEmail(false)}>
              ✕
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn-secondary flex items-center justify-center gap-1.5 py-2.5 text-sm"
            onClick={() => setAddingEmail(true)}
          >
            ✉️ + Add email
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
