/**
 * Session 22, round 11 — thin wrapper around Resend's HTTP API. No SDK
 * dependency (Resend's API is a single plain JSON POST, and this app
 * already prefers a raw `fetch` over adding a package for a one-call
 * integration — see the Gemini call in payment-verification.ts for the
 * same pattern). Two secrets drive this, both set with `wrangler secret
 * put` (never committed, same as DATABASE_URL/NEXTAUTH_SECRET):
 *  - RESEND_API_KEY — from the user's Resend account.
 *  - RESEND_FROM_EMAIL — must be on a domain verified in that Resend
 *    account (Resend rejects sends from an unverified domain), e.g.
 *    "invoices@ignitesafety.shop". Falls back to Resend's own shared
 *    "onboarding@resend.dev" sender, which only delivers to the Resend
 *    account's own verified address — fine for a first connectivity
 *    test, not for real customer delivery.
 */

export type EmailAttachment = { filename: string; content: string /* base64 */ };

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: EmailAttachment[];
};

export class EmailNotConfiguredError extends Error {
  constructor() {
    super('Email sending is not set up yet — ask an admin to add a Resend API key in Settings.');
    this.name = 'EmailNotConfiguredError';
  }
}

export async function sendEmail(input: SendEmailInput): Promise<{ id: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new EmailNotConfiguredError();
  const from = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
      attachments: input.attachments,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Resend API error (${res.status}): ${body || res.statusText}`);
  }
  const data = (await res.json()) as { id: string };
  return data;
}
