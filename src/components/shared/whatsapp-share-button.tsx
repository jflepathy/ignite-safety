'use client';

/**
 * Session 22, round 11 — "for now do the whatsapp link" (the user's own
 * words): opens WhatsApp with a pre-filled message containing the
 * invoice's existing public share link, for the user to review and send
 * themselves. Deliberately NOT an automatic send and NOT an attached PDF
 * — sending an actual file requires the official Meta WhatsApp Business
 * Cloud API (a dedicated business phone number, approval, per-message
 * cost — see the research shared with the user), which they've deferred
 * for now. This is the safe, zero-setup interim: no API, no risk to the
 * user's real WhatsApp number, and the user stays in control of what's
 * actually sent since WhatsApp opens with the message drafted but not
 * yet sent.
 *
 * Phone numbers in this app are stored as bare local Seychelles numbers
 * (e.g. "2515001", no +248, sometimes messy free text like "2857425\n
 * Mobile: 2815586" per a live check of real customer records) — rather
 * than guess wrong and pre-fill an invalid number, a phone that doesn't
 * cleanly reduce to a 7-digit local number is left out of the link
 * entirely, which makes WhatsApp open its own contact picker instead of
 * assuming a wrong recipient.
 */
function normalizeSeychellesWhatsApp(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digitsOnly = phone.replace(/\D/g, '');
  // Already has the country code
  if (digitsOnly.startsWith('248') && digitsOnly.length === 10) return digitsOnly;
  // Bare local number (Seychelles mobile/landline numbers are 7 digits)
  if (digitsOnly.length === 7) return `248${digitsOnly}`;
  // Anything else (multi-number free text, malformed) — don't guess.
  return null;
}

export default function WhatsAppShareButton({
  phone,
  customerName,
  documentLabel,
  documentNumber,
  companyName,
  path,
}: {
  phone: string | null | undefined;
  customerName: string;
  documentLabel: string;
  documentNumber: string;
  companyName: string;
  path: string;
}) {
  const waNumber = normalizeSeychellesWhatsApp(phone);

  // Built client-side (not passed in as a pre-formed URL) because this
  // button is rendered from a server component, where `window` doesn't
  // exist — same reasoning as ShareLinkButton just above it on the page.
  function open() {
    const fullLink = `${window.location.origin}${path}`;
    const message = `Hi ${customerName}, here is your ${documentLabel} ${documentNumber} from ${companyName}: ${fullLink}`;
    const url = `https://wa.me/${waNumber ?? ''}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <button
      type="button"
      className="btn-secondary"
      onClick={open}
      title={waNumber ? undefined : 'No valid phone on file — pick the contact in WhatsApp'}
    >
      💬 Share via WhatsApp
    </button>
  );
}
