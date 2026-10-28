import { prisma } from '@/lib/prisma';
import { sendEmail, EmailNotConfiguredError } from '@/lib/email';
import { ensureShareToken } from '@/lib/share-token';
import { formatDate } from '@/lib/format-date';
import { formatMoney } from '@/lib/money';
import type { JobResult } from './types';

const DAY = 86400000;
const MAX_PER_RUN = 20;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Payment reminders on the schedule in Settings > Messages & Reminders
 * (reminderScheduleDays, relative to the due date: -3 = three days before,
 * 0 = on the day, 7 = a week late ...). A reminder is only sent on its day
 * (or the day after, if a run was missed), so switching this on never
 * floods customers with reminders for old invoices. One email per invoice
 * per schedule step (ReminderLog).
 */
export async function runPaymentReminders(opts: { dryRun: boolean; origin: string }): Promise<JobResult> {
  const settings = await prisma.appSettings.findUnique({ where: { id: 1 } });
  if (!settings?.autoPaymentRemindersEnabled) return { ok: true, summary: 'Skipped - automatic payment reminders are switched off in Settings.', items: [], more: false };
  const offsets = (Array.isArray(settings.reminderScheduleDays) ? (settings.reminderScheduleDays as unknown[]) : [])
    .map((n) => Number(n))
    .filter((n) => Number.isInteger(n))
    .sort((a, b) => a - b);
  if (offsets.length === 0) return { ok: true, summary: 'No reminder schedule set.', items: [], more: false };

  const now = new Date();
  const todayMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const minOff = offsets[0], maxOff = offsets[offsets.length - 1];
  // daysSinceDue in [minOff, maxOff + 1]
  const dueFrom = new Date(todayMs - (maxOff + 1) * DAY);
  const dueTo = new Date(todayMs - minOff * DAY);

  const invoices = await prisma.invoice.findMany({
    where: {
      deletedAt: null,
      status: { in: ['SENT', 'PARTIAL', 'OVERDUE'] },
      balanceDue: { gt: 0 },
      dueDate: { gte: dueFrom, lte: dueTo },
      NOT: { invoiceNumber: { startsWith: 'OB-' } },
    },
    include: { customer: { select: { displayName: true, email: true } } },
    take: 200,
  });
  const logs = invoices.length
    ? await prisma.reminderLog.findMany({ where: { invoiceId: { in: invoices.map((i) => i.id) } } })
    : [];
  const sentSet = new Set(logs.map((l) => `${l.invoiceId}|${l.offsetDays}`));

  type Cand = { inv: (typeof invoices)[number]; offset: number };
  const cands: Cand[] = [];
  for (const inv of invoices) {
    if (!inv.dueDate || !inv.customer.email) continue;
    const dueMs = Date.UTC(inv.dueDate.getUTCFullYear(), inv.dueDate.getUTCMonth(), inv.dueDate.getUTCDate());
    const since = Math.round((todayMs - dueMs) / DAY);
    const hit = offsets.filter((o) => since - o >= 0 && since - o <= 1 && !sentSet.has(`${inv.id}|${o}`));
    if (hit.length) cands.push({ inv, offset: Math.max(...hit) });
  }

  const batch = cands.slice(0, MAX_PER_RUN);
  const items: string[] = [];
  const currency = settings.currencyCode ?? 'SCR';
  const company = settings.companyName ?? 'Ignite Safety';
  let sent = 0, failed = 0;
  for (const { inv, offset } of batch) {
    const label = `${inv.invoiceNumber} -> ${inv.customer.email} (${offset < 0 ? `${-offset}d before due` : offset === 0 ? 'due today' : `${offset}d overdue`})`;
    if (opts.dryRun) {
      items.push(`WOULD SEND ${label}`);
      continue;
    }
    try {
      const token = await ensureShareToken('invoice', inv.id, inv.shareToken);
      const link = `${opts.origin}/share/invoice/${token}`;
      const amount = formatMoney(Number(inv.balanceDue), currency);
      const due = formatDate(inv.dueDate);
      const intro =
        offset < 0
          ? `This is a friendly reminder that invoice ${inv.invoiceNumber} for ${amount} is due on ${due}.`
          : offset === 0
            ? `Invoice ${inv.invoiceNumber} for ${amount} is due today (${due}).`
            : `Our records show invoice ${inv.invoiceNumber} for ${amount}, due on ${due}, is still unpaid.`;
      const pay = settings.paymentInstructions ? `\n\nHow to pay:\n${settings.paymentInstructions}` : '';
      const text = `Dear ${inv.customer.displayName},\n\n${intro}\n\nView or print the invoice: ${link}${pay}\n\nIf you have already paid, please disregard this message and accept our thanks.\n\n${company}`;
      const html = `<p>Dear ${esc(inv.customer.displayName)},</p><p>${esc(intro)}</p><p><a href="${link}">View or print the invoice</a></p>${
        settings.paymentInstructions ? `<p><strong>How to pay</strong><br/>${esc(settings.paymentInstructions).replace(/\n/g, '<br/>')}</p>` : ''
      }<p>If you have already paid, please disregard this message and accept our thanks.</p><p>${esc(company)}</p>`;
      await sendEmail({
        to: inv.customer.email!,
        subject: offset < 0 ? `Payment reminder: invoice ${inv.invoiceNumber} due ${due}` : offset === 0 ? `Invoice ${inv.invoiceNumber} is due today` : `Overdue: invoice ${inv.invoiceNumber}`,
        text,
        html,
      });
      await prisma.reminderLog.create({ data: { invoiceId: inv.id, offsetDays: offset, toEmail: inv.customer.email } });
      sent++;
      items.push(`SENT ${label}`);
    } catch (e: any) {
      if (e instanceof EmailNotConfiguredError) return { ok: false, summary: e.message, items, more: false };
      failed++;
      items.push(`FAILED ${label}: ${e?.message ?? e}`);
    }
  }
  return {
    ok: failed === 0,
    summary: opts.dryRun ? `${cands.length} reminder(s) would go out today.` : `Sent ${sent} reminder(s)${failed ? `, ${failed} failed` : ''}; ${Math.max(0, cands.length - batch.length)} still queued.`,
    items,
    more: !opts.dryRun && cands.length > batch.length && sent > 0,
  };
}
