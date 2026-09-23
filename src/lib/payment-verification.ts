// AI-based cheque / bank-transfer proof-photo verification (Session 16,
// switched to Gemini in the follow-up session).
//
// Originally called the Anthropic Messages API, but this is a simple,
// low-volume "read the amount off a photo" job, and Google's Gemini API
// has a genuinely free tier (get a key at https://aistudio.google.com/apikey
// — no credit card, no billing needed for this kind of light usage) that's
// more than enough for it. Plain fetch() rather than a client library —
// this app has no other Google dependency, and a raw HTTPS POST is one
// file with no extra package to keep working on Cloudflare Workers.
//
// Gated entirely behind GEMINI_API_KEY being set (read the same way
// DATABASE_URL is — see src/lib/prisma.ts — process.env is wired through
// by OpenNext on this Workers deployment). Until the user provides a key
// (set via `wrangler secret put GEMINI_API_KEY` on the deployment
// machine), verifyPaymentPhoto() returns { available: false } and every
// call site falls back to leaving the payment PENDING_REVIEW for an admin
// to confirm by hand (see the "Payments awaiting review" card on the
// Billing page) — the feature is fully usable either way, and starts
// auto-confirming the moment the key is added, with no further code
// changes needed.

// A stable alias, not a dated version -- "gemini-2.0-flash" (the original
// model used here) was retired by Google on 2026-06-01, which is why the
// key the user added still didn't produce automatic verification: every
// call was silently hitting a dead model and falling back to a MISMATCH
// with "AI verification call failed (HTTP 404)" in the payment's notes.
// "gemini-flash-latest" is Google's self-updating alias for the current
// flash-tier model, so this doesn't need chasing again next time Google
// retires a dated model name (Session 19).
const GEMINI_MODEL = 'gemini-flash-latest';

export type PaymentPhotoVerification =
  | { available: false }
  | {
      available: true;
      matches: boolean;
      confidence: 'high' | 'medium' | 'low';
      extractedAmount: number | null;
      notes: string;
    };

export async function verifyPaymentPhoto(opts: {
  method: 'CHEQUE' | 'BANK_TRANSFER';
  photoDataUrl: string; // data:image/...;base64,...
  expectedAmount: number;
  currency: string;
  payeeName: string; // who the cheque/transfer should be made out to
}): Promise<PaymentPhotoVerification> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { available: false };

  const match = opts.photoDataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (!match) return { available: false };
  const [, mediaType, base64Data] = match;

  const prompt = `You are verifying a photo of a ${opts.method === 'CHEQUE' ? 'cheque' : 'bank transfer confirmation'} against an expected payment.
Expected payee: ${opts.payeeName}
Expected amount: ${opts.expectedAmount.toFixed(2)} ${opts.currency}

Look at the photo and determine:
1. The amount shown (in figures) — extract it as a plain number.
2. Whether that amount matches the expected amount (small rounding differences are fine, but not a materially different amount).
3. Whether the payee/recipient name is consistent with the expected payee (be lenient about minor spelling/formatting differences).

Respond with ONLY a JSON object, no other text, in exactly this shape:
{"matches": true|false, "confidence": "high"|"medium"|"low", "extractedAmount": <number or null>, "notes": "<one short sentence explaining your verdict>"}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ inline_data: { mime_type: mediaType, data: base64Data } }, { text: prompt }],
            },
          ],
          generationConfig: { temperature: 0, maxOutputTokens: 512 },
        }),
      }
    );
    if (!res.ok) {
      return { available: true, matches: false, confidence: 'low', extractedAmount: null, notes: `AI verification call failed (HTTP ${res.status}) — left for manual review.` };
    }
    const json: any = await res.json();
    const text: string = json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? '').join('') ?? '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { available: true, matches: false, confidence: 'low', extractedAmount: null, notes: 'AI response could not be parsed — left for manual review.' };
    }
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      available: true,
      matches: !!parsed.matches,
      confidence: parsed.confidence === 'high' || parsed.confidence === 'medium' ? parsed.confidence : 'low',
      extractedAmount: typeof parsed.extractedAmount === 'number' ? parsed.extractedAmount : null,
      notes: typeof parsed.notes === 'string' ? parsed.notes : '',
    };
  } catch (e: any) {
    return { available: true, matches: false, confidence: 'low', extractedAmount: null, notes: `AI verification error: ${e.message ?? 'unknown'} — left for manual review.` };
  }
}
