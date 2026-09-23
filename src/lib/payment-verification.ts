// AI-based cheque / bank-transfer proof-photo verification (Session 16).
//
// Plain fetch() to the Anthropic Messages API rather than the SDK — this
// app has no other Anthropic dependency, and a raw HTTPS POST is one file
// with no extra package to keep working on Cloudflare Workers.
//
// Gated entirely behind ANTHROPIC_API_KEY being set (read the same way
// DATABASE_URL is — see src/lib/prisma.ts — process.env is wired through
// by OpenNext on this Workers deployment). Until the user provides a key
// (set via `wrangler secret put ANTHROPIC_API_KEY` on the deployment
// machine), verifyPaymentPhoto() returns { available: false } and every
// call site falls back to leaving the payment PENDING_REVIEW for an admin
// to confirm by hand — the feature is fully usable either way, and starts
// auto-confirming the moment the key is added, with no further code
// changes needed.

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
  const apiKey = process.env.ANTHROPIC_API_KEY;
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
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 512,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
              { type: 'text', text: prompt },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      return { available: true, matches: false, confidence: 'low', extractedAmount: null, notes: `AI verification call failed (HTTP ${res.status}) — left for manual review.` };
    }
    const json: any = await res.json();
    const text: string = json?.content?.[0]?.text ?? '';
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
