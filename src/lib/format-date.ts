// Session 22, round 12 — the user asked for dd/mm/yyyy everywhere in the
// app, replacing the previous `.toLocaleDateString()` / `.toLocaleString()`
// calls (which render as the server's default locale — effectively
// en-US, mm/dd/yyyy — since nothing in this app ever passed a locale or
// format options to them).
//
// Uses the UTC calendar fields, not local ones: every date-only column in
// this schema (issueDate, dueDate, billDate, scheduledDate, etc.) is
// stored as a Postgres DateTime at UTC midnight with no real time-of-day
// meaning, and Cloudflare Workers' runtime clock is UTC — so `getUTCDate()`
// and `getDate()` already agree there today, but pinning to UTC explicitly
// means this can never silently shift a date by a day if that ever
// changes, which a local-timezone read could.
//
// NOTE: this only covers *displayed* dates. Native `<input type="date">`
// fields render in whatever format the visitor's own browser/OS locale
// uses — that's outside the page's control (the field's underlying value
// is always ISO yyyy-mm-dd regardless of display) and isn't changed by
// this file. A custom date-picker component would be a separate, larger
// piece of work if dd/mm/yyyy is ever needed there too.

function toDate(date: Date | string): Date {
  return typeof date === 'string' ? new Date(date) : date;
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = toDate(date);
  if (isNaN(d.getTime())) return '';
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/** dd/mm/yyyy HH:mm — for real timestamps (createdAt, deletedAt, and the
 * like), not date-only columns. */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = toDate(date);
  if (isNaN(d.getTime())) return '';
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  return `${formatDate(d)} ${hh}:${min}`;
}
