import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { nextDocumentNumber } from '@/lib/numbering';
import { computeDocumentTotals } from '@/lib/money';
import { insertEstimateOrInvoiceLines } from '@/lib/bulk-line-items';
import type { JobResult } from './types';

const MAX_PER_RUN = 5;

function advance(frequency: string, interval: number, from: Date): Date {
  const n = new Date(from);
  const k = Math.max(1, interval || 1);
  if (frequency === 'WEEKLY') n.setUTCDate(n.getUTCDate() + 7 * k);
  else if (frequency === 'QUARTERLY') n.setUTCMonth(n.getUTCMonth() + 3 * k);
  else if (frequency === 'ANNUALLY') n.setUTCFullYear(n.getUTCFullYear() + k);
  else n.setUTCMonth(n.getUTCMonth() + k);
  return n;
}

function dueDateFromTerms(issue: Date, terms?: string | null): Date | null {
  const m = terms?.match(/(\d+)/);
  if (!m) return null;
  return new Date(issue.getTime() + Number(m[1]) * 86400000);
}

/**
 * Creates the next invoice for every active recurring-invoice template that
 * has reached its run date. The new invoice is issued (status Sent) with
 * today's date; it is NOT emailed automatically. If runs were missed the
 * template catches up with a single invoice, not one per missed period.
 */
export async function runRecurringInvoices(opts: { dryRun: boolean }): Promise<JobResult> {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const due = await prisma.recurringTemplate.findMany({
    where: { active: true, documentType: 'INVOICE', nextRunDate: { lte: now }, OR: [{ endDate: null }, { endDate: { gte: today } }] },
    orderBy: { nextRunDate: 'asc' },
    take: MAX_PER_RUN + 1,
  });
  const batch = due.slice(0, MAX_PER_RUN);
  const items: string[] = [];
  let made = 0, failed = 0;
  for (const t of batch) {
    const data: any = t.templateData ?? {};
    const lines: any[] = Array.isArray(data.lineItems) ? data.lineItems : [];
    if (!t.customerId || lines.length === 0) {
      items.push(`SKIPPED ${t.name}: template has no customer or lines`);
      continue;
    }
    if (opts.dryRun) {
      items.push(`WOULD CREATE invoice from "${t.name}" (next run ${t.nextRunDate.toISOString().slice(0, 10)})`);
      continue;
    }
    try {
      const totals = computeDocumentTotals(
        lines.map((l) => ({ quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), discountPercent: Number(l.discountPercent ?? 0), taxRatePercent: Number(l.taxRatePercent ?? 0) })),
        Number(data.globalDiscountPercent ?? 0),
        !!data.taxInclusive
      );
      const invoiceNumber = await nextDocumentNumber('invoiceNextSeq', 'invoicePrefix');
      const inv = await prisma.invoice.create({
        data: {
          invoiceNumber,
          customerId: t.customerId,
          status: 'SENT',
          issueDate: today,
          dueDate: dueDateFromTerms(today, data.terms),
          globalDiscountPercent: Number(data.globalDiscountPercent ?? 0),
          subtotal: totals.subtotal,
          discountTotal: totals.discountTotal,
          taxTotal: totals.taxTotal,
          total: totals.total,
          balanceDue: totals.total,
          terms: data.terms ?? null,
          taxInclusive: !!data.taxInclusive,
          shareToken: randomBytes(16).toString('hex'),
          isRecurring: true,
          recurringTemplateId: t.id,
          createdById: t.createdById,
        },
      });
      await insertEstimateOrInvoiceLines('invoice', inv.id, lines.map((l, i) => ({ ...l, lineTotal: totals.lines[i].lineTotal, sortOrder: i })));
      let next = advance(t.frequency, t.intervalCount, t.nextRunDate);
      for (let guard = 0; next <= now && guard < 500; guard++) next = advance(t.frequency, t.intervalCount, next);
      await prisma.recurringTemplate.update({ where: { id: t.id }, data: { nextRunDate: next } });
      await prisma.auditLog.create({ data: { userId: t.createdById, action: 'INVOICE_CREATED', entityType: 'Invoice', entityId: inv.id, metadata: { invoiceNumber, recurring: t.id, total: totals.total } } });
      made++;
      items.push(`CREATED ${invoiceNumber} from "${t.name}"`);
    } catch (e: any) {
      failed++;
      items.push(`FAILED "${t.name}": ${e?.message ?? e}`);
    }
  }
  return {
    ok: failed === 0,
    summary: opts.dryRun ? `${due.length} recurring invoice(s) would be created.` : `Created ${made} recurring invoice(s)${failed ? `, ${failed} failed` : ''}.`,
    items,
    more: !opts.dryRun && due.length > MAX_PER_RUN && made > 0,
  };
}
