import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { formatDate } from '@/lib/format-date';

/**
 * Period lock ("books closed through"). Once an admin closes the books through
 * a date, nothing dated on or before that day can be added, changed or deleted,
 * so filed figures can't drift. Dates are compared as Seychelles calendar days.
 */
const SEY_OFFSET_MS = 4 * 60 * 60 * 1000;

export function seyDay(d: Date | string): string {
  const dt = typeof d === 'string' ? new Date(d) : d;
  return new Date(dt.getTime() + SEY_OFFSET_MS).toISOString().slice(0, 10);
}

export async function booksClosedThrough(): Promise<string | null> {
  const s = await prisma.appSettings.findUnique({ where: { id: 1 }, select: { booksClosedThrough: true } });
  return s?.booksClosedThrough ? s.booksClosedThrough.toISOString().slice(0, 10) : null;
}

/**
 * Returns a 409 response if any of the given dates falls in a closed period,
 * otherwise null. Pass every date the action touches (old and new date on an edit).
 */
export async function closedPeriodResponse(...dates: (Date | string | null | undefined)[]): Promise<NextResponse | null> {
  const lock = await booksClosedThrough();
  if (!lock) return null;
  for (const d of dates) {
    if (!d) continue;
    if (seyDay(d) <= lock) {
      const msg = `The books are closed through ${formatDate(new Date(lock + 'T00:00:00Z'))}. Entries dated on or before that day can't be added or changed. An admin can reopen the period under Accounting > Ledger tools.`;
      return NextResponse.json({ error: { formErrors: [msg] }, message: msg }, { status: 409 });
    }
  }
  return null;
}
