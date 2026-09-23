// Shared "page by calendar month, in UTC" helpers (Session 21) -- used by
// the technician Incentive tab and the admin Incentive History section so
// "what counts as June" can't quietly drift between what a technician sees
// and what admin uses to pay them.
export function monthBounds(monthStr: string) {
  const [y, m] = monthStr.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { start, end };
}

export function monthLabel(monthStr: string) {
  const { start } = monthBounds(monthStr);
  return start.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function shiftMonth(monthStr: string, delta: number) {
  const [y, m] = monthStr.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function currentMonthStr(now: Date = new Date()) {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function isValidMonthStr(s: string | undefined): s is string {
  return !!s && /^\d{4}-\d{2}$/.test(s);
}
