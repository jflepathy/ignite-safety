import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';

/**
 * Fetches current exchange rates against the base currency from a free,
 * no-API-key FX provider (frankfurter.app, backed by the European Central
 * Bank's daily reference rates) and updates every currency the business
 * has a rate row for — skipping any that are individually locked, or all
 * of them if the global "Lock all rates" setting is on.
 *
 * Called two ways:
 *  - Manually, via the "Refresh now" button in Admin > Multi-Currency.
 *  - Automatically, once a day, from a Vercel Cron Job hitting this route
 *    (see vercel.json) — this is the "automatic daily exchange rate
 *    retrieval" the multi-currency engine provides. Vercel Cron sends a
 *    bearer token in CRON_SECRET; requests without it fall back to the
 *    normal Admin-session check so the "Refresh now" button keeps working.
 */
export async function GET(req: NextRequest) {
  // Vercel Cron Jobs invoke via GET; the manual "Refresh now" button uses POST.
  return POST(req);
}

export async function POST(req: NextRequest) {
  const cronSecret = req.headers.get('authorization');
  const isCron = process.env.CRON_SECRET && cronSecret === `Bearer ${process.env.CRON_SECRET}`;
  if (!isCron) {
    const { error } = await requireRole('ADMIN');
    if (error) return error;
  }

  const settings = await prisma.appSettings.findUnique({ where: { id: 1 } });
  if (!settings) return NextResponse.json({ error: 'Settings not found' }, { status: 500 });

  const base = settings.baseCurrency ?? 'SCR';
  const existing = await prisma.exchangeRate.findMany();
  const eligible = existing.filter((r) => !r.locked && !settings.fxRateLockEnabled);

  if (eligible.length === 0) {
    return NextResponse.json({ ok: true, updated: 0, message: 'No unlocked currencies to refresh.' });
  }

  let rates: Record<string, number> = {};
  try {
    const symbols = eligible.map((r) => r.currencyCode).join(',');
    const res = await fetch(`https://api.frankfurter.app/latest?from=${base}&to=${symbols}`, {
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`FX provider returned ${res.status}`);
    const body = await res.json();
    rates = body.rates ?? {};
  } catch (e: any) {
    return NextResponse.json({ error: `Could not reach FX provider: ${e.message}` }, { status: 502 });
  }

  let updated = 0;
  for (const r of eligible) {
    const providerRate = rates[r.currencyCode]; // provider gives base->currency; we store currency->base (1 unit of currency = X base)
    if (!providerRate) continue;
    const rateToBase = 1 / providerRate;
    // eslint-disable-next-line no-await-in-loop
    await prisma.exchangeRate.update({
      where: { currencyCode: r.currencyCode },
      data: { rateToBase, isManualOverride: false, source: 'frankfurter.app' },
    });
    updated += 1;
  }

  await prisma.appSettings.update({ where: { id: 1 }, data: { fxLastFetchedAt: new Date() } });

  return NextResponse.json({ ok: true, updated });
}
