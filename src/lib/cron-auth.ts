// Shared by the Worker's scheduled() handler (worker.ts) and the API routes
// it calls. No new secret to manage: the token is derived from the existing
// NEXTAUTH_SECRET, so only code that holds that secret can call a cron route.
export async function cronToken(secret: string): Promise<string> {
  const data = new TextEncoder().encode(`${secret}:cron-v1`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function isCronRequest(req: Request): Promise<boolean> {
  const secret = process.env.NEXTAUTH_SECRET;
  const got = req.headers.get('x-cron-token');
  if (!secret || !got) return false;
  return got === (await cronToken(secret));
}
