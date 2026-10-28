import { addMonths } from 'date-fns';
import { prisma } from '@/lib/prisma';
import { nextDocumentNumber } from '@/lib/numbering';
import { loadBatchClients } from '@/lib/servicing-batches';
import type { JobResult } from './types';

const MAX_PER_RUN = 8;
const DAY = 86400000;

type Need = { customerId: string; name: string; dueMs: number; counts: Record<string, number>; source: string };

/**
 * Raises a Servicing Request (status New, visible in Outreach) for every
 * customer whose next service falls due within the lead time in Settings >
 * Scheduling (reminderLeadDays, default 45 days). Customers are taken from
 * their equipment records first, and from their latest servicing batch when
 * they have no equipment on file. Anything more than 30 days overdue is left
 * to manual outreach, and a customer with an open request is never doubled up.
 */
export async function runServiceDueNotices(opts: { dryRun: boolean }): Promise<JobResult> {
  const settings = await prisma.appSettings.findUnique({ where: { id: 1 } });
  if (!settings?.smartRemindersEnabled) return { ok: true, summary: 'Skipped - smart service reminders are switched off in Settings.', items: [], more: false };
  const lead = settings.reminderLeadDays ?? 45;
  const now = new Date();
  const todayMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const windowEnd = todayMs + lead * DAY;
  const windowStart = todayMs - 30 * DAY;

  const [equipment, open, batchClients] = await Promise.all([
    prisma.equipment.findMany({ where: { deletedAt: null, status: 'ACTIVE' }, select: { customerId: true, category: true, lastServiceDate: true, installDate: true, createdAt: true, intervalMonths: true, customer: { select: { displayName: true, deletedAt: true } } } }),
    prisma.serviceRequest.findMany({ where: { status: { in: ['NEW', 'SCHEDULED'] } }, select: { customerId: true } }),
    loadBatchClients(),
  ]);
  const hasOpen = new Set(open.map((o) => o.customerId));
  const needs = new Map<string, Need>();

  // 1) equipment-driven
  const byCust = new Map<string, typeof equipment>();
  for (const e of equipment) {
    if (e.customer.deletedAt) continue;
    (byCust.get(e.customerId) ?? byCust.set(e.customerId, []).get(e.customerId)!).push(e);
  }
  const equipmentCustomers = new Set(byCust.keys());
  for (const [cid, list] of byCust) {
    const dues = list.map((e) => ({ e, due: addMonths(e.lastServiceDate ?? e.installDate ?? e.createdAt, e.intervalMonths || 12).getTime() }));
    const inWindow = dues.filter((d) => d.due >= windowStart && d.due <= windowEnd);
    if (!inWindow.length) continue;
    const counts: Record<string, number> = {};
    for (const d of inWindow) counts[d.e.category] = (counts[d.e.category] ?? 0) + 1;
    needs.set(cid, { customerId: cid, name: list[0].customer.displayName, dueMs: Math.min(...inWindow.map((d) => d.due)), counts, source: 'equipment records' });
  }
  // 2) batch-driven, customers without equipment records
  for (const c of batchClients) {
    if (!c.customerId || equipmentCustomers.has(c.customerId) || needs.has(c.customerId)) continue;
    const due = new Date(c.nextDueDate).getTime();
    if (due < windowStart || due > windowEnd) continue;
    const counts: Record<string, number> = {};
    if (c.latest.extinguishers) counts.FIRE_EXTINGUISHER = c.latest.extinguishers;
    if (c.latest.fireBlankets) counts.FIRE_BLANKET = c.latest.fireBlankets;
    if (c.latest.hoseReels) counts.HOSE_REEL = c.latest.hoseReels;
    if (c.latest.detectors) counts.SMOKE_DETECTOR = c.latest.detectors;
    needs.set(c.customerId, { customerId: c.customerId, name: c.clientName, dueMs: due, counts, source: 'last servicing batch' });
  }

  const todo = Array.from(needs.values()).filter((n) => !hasOpen.has(n.customerId)).sort((a, b) => a.dueMs - b.dueMs);
  const batch = todo.slice(0, MAX_PER_RUN);
  const items: string[] = [];
  let made = 0, failed = 0;
  for (const n of batch) {
    const when = new Date(Math.max(n.dueMs, todayMs + 7 * DAY));
    const summary = Object.entries(n.counts).map(([k, v]) => `${v} ${k.toLowerCase().replace(/_/g, ' ')}`).join(', ');
    if (opts.dryRun) {
      items.push(`WOULD REQUEST ${n.name} - due ${new Date(n.dueMs).toISOString().slice(0, 10)} (${summary || 'no counts'}) from ${n.source}`);
      continue;
    }
    try {
      const requestNumber = await nextDocumentNumber('serviceRequestNextSeq', 'serviceRequestPrefix');
      const cust = await prisma.customer.findUnique({ where: { id: n.customerId }, select: { region: true, district: true } });
      const sr = await prisma.serviceRequest.create({
        data: {
          requestNumber,
          customerId: n.customerId,
          serviceType: 'ONSITE',
          proposedDate: when,
          region: cust?.region,
          district: cust?.district,
          notes: `Auto-created: annual servicing due ${new Date(n.dueMs).toISOString().slice(0, 10)} (from ${n.source}).`,
        },
      });
      for (const [category, count] of Object.entries(n.counts)) {
        await prisma.serviceRequestEquipmentCount.create({ data: { serviceRequestId: sr.id, category: category as any, tentativeCount: count } });
      }
      made++;
      items.push(`REQUESTED ${requestNumber} for ${n.name} (${summary || 'no counts'})`);
    } catch (e: any) {
      failed++;
      items.push(`FAILED ${n.name}: ${e?.message ?? e}`);
    }
  }
  return {
    ok: failed === 0,
    summary: opts.dryRun ? `${todo.length} service request(s) would be raised.` : `Raised ${made} service request(s)${failed ? `, ${failed} failed` : ''}; ${Math.max(0, todo.length - batch.length)} still to do.`,
    items,
    more: !opts.dryRun && todo.length > batch.length && made > 0,
  };
}
