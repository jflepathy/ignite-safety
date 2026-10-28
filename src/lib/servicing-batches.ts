import { prisma } from '@/lib/prisma';
import { addMonths, differenceInCalendarDays, startOfDay } from 'date-fns';

export type BatchHistory = {
  id: string;
  batchMonth: string; // ISO
  serviceDate: string;
  extinguishers: number;
  hoseReels: number;
  fireBlankets: number;
  detectors: number;
  otherItems: number;
  source: string;
  sourceRef: string | null;
  notes: string | null;
};

export type BatchClient = {
  key: string; // dedupe key without the month part
  customerId: string | null;
  clientName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  region: string | null;
  latest: BatchHistory;
  nextDueDate: string;
  daysUntilDue: number;
  history: BatchHistory[]; // newest first
};

export function clientKeyOf(dedupeKey: string) {
  const i = dedupeKey.lastIndexOf('|');
  return i === -1 ? dedupeKey : dedupeKey.slice(0, i);
}

/**
 * Historical servicing, grouped per client: the latest monthly batch drives
 * the next-due date (service date + 12 months), older batches are kept as
 * history. Linked customers use their live customer record for contact info;
 * prospects (no customer yet) use what was captured at import.
 */
export async function loadBatchClients(): Promise<BatchClient[]> {
  const batches = await prisma.servicingBatch.findMany({
    include: { customer: { select: { displayName: true, phone: true, email: true, address: true, region: true, deletedAt: true } } },
    orderBy: { serviceDate: 'desc' },
  });
  const today = startOfDay(new Date());
  const map = new Map<string, BatchClient>();
  for (const b of batches) {
    const key = clientKeyOf(b.dedupeKey);
    const hist: BatchHistory = {
      id: b.id,
      batchMonth: b.batchMonth.toISOString(),
      serviceDate: b.serviceDate.toISOString(),
      extinguishers: b.extinguishers,
      hoseReels: b.hoseReels,
      fireBlankets: b.fireBlankets,
      detectors: b.detectors,
      otherItems: b.otherItems,
      source: b.source,
      sourceRef: b.sourceRef,
      notes: b.notes,
    };
    const existing = map.get(key);
    if (existing) {
      existing.history.push(hist);
      continue;
    }
    const cust = b.customer && !b.customer.deletedAt ? b.customer : null;
    const nextDue = addMonths(b.serviceDate, 12);
    map.set(key, {
      key,
      customerId: cust ? b.customerId : null,
      clientName: cust?.displayName ?? b.clientName,
      phone: cust?.phone ?? b.phone,
      email: cust?.email ?? null,
      address: cust?.address ?? b.address,
      region: cust?.region ?? null,
      latest: hist,
      nextDueDate: nextDue.toISOString(),
      daysUntilDue: differenceInCalendarDays(nextDue, today),
      history: [hist],
    });
  }
  return Array.from(map.values()).sort((a, b) => a.daysUntilDue - b.daysUntilDue);
}
