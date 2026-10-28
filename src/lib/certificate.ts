import { prisma } from '@/lib/prisma';
import { addMonths, startOfMonth } from 'date-fns';
import { formatDate } from '@/lib/format-date';
import { documentSettings } from '@/lib/document-data';
import { EQUIPMENT_CATEGORIES } from '@/lib/equipment-categories';

export type CertificateItem = {
  no: number;
  type: string;
  serial: string;
  location: string;
  result: string; // PASS | FAIL | N/A
  notes: string;
};

export type CertificateData = {
  settings: ReturnType<typeof documentSettings>;
  certificateNumber: string;
  workOrderNumber: string;
  invoiceNumber: string | null;
  serviceDate: string;
  nextDueDate: string;
  customer: { displayName: string; address: string | null; phone: string | null };
  siteAddress: string | null;
  items: CertificateItem[];
  summary: { label: string; quantity: number }[]; // counts from the POS cart
  technicians: string[];
  technicianNotes: string | null;
  customerSignedName: string | null;
  customerSignatureDataUrl: string | null;
  declaration: string;
};

export const CERTIFICATE_DECLARATION =
  "This is to certify that the fire safety equipment listed in this certificate was inspected and serviced by the technician(s) named below on the date shown, in accordance with the manufacturer's recommendations and good industry practice. Equipment marked FAIL requires repair or replacement and should not be relied on until corrected. The next service is due by the date shown.";

const label = (v: string) => EQUIPMENT_CATEGORIES.find((c) => c.value === v)?.label.replace(/s$/, '') ?? v;

async function nextCertificateNumber(year: number): Promise<string> {
  const prefix = `CERT-${year}-`;
  const last = await prisma.workOrder.findFirst({
    where: { certificateNumber: { startsWith: prefix } },
    orderBy: { certificateNumber: 'desc' },
    select: { certificateNumber: true },
  });
  const n = last?.certificateNumber ? parseInt(last.certificateNumber.slice(prefix.length), 10) || 0 : 0;
  return `${prefix}${String(n + 1).padStart(4, '0')}`;
}

function countFromLabel(l: string): 'ext' | 'hose' | 'blanket' | 'detector' | null {
  const s = l.toLowerCase();
  if (/(f\/ext|extinguisher|co2|dcp|dry powder|foam)/.test(s)) return 'ext';
  if (/hose/.test(s)) return 'hose';
  if (/blanket/.test(s)) return 'blanket';
  if (/(smoke|heat).*detector|detector/.test(s)) return 'detector';
  return null;
}

/**
 * Issues (or returns) the servicing certificate number for a completed work
 * order, refreshes the last-service date of the equipment that was inspected,
 * and records the job as a servicing batch for the customer's month (skipped
 * when that month already has a batch, so imported history is never doubled).
 */
export async function issueCertificate(workOrderId: string): Promise<{ certificateNumber: string; created: boolean } | { error: string }> {
  const wo = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    include: { inspectionItems: true },
  });
  if (!wo) return { error: 'Work order not found' };
  if (wo.status !== 'COMPLETED') return { error: 'Only completed work orders get a certificate' };
  if (wo.certificateNumber) return { certificateNumber: wo.certificateNumber, created: false };

  const done = wo.completedAt ?? new Date();
  let number = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    number = await nextCertificateNumber(done.getUTCFullYear());
    try {
      await prisma.workOrder.update({ where: { id: wo.id }, data: { certificateNumber: number, certificateIssuedAt: new Date() } });
      break;
    } catch (e) {
      if (attempt === 2) return { error: 'Could not allocate a certificate number, try again.' };
    }
  }

  // Equipment last-service dates
  for (const it of wo.inspectionItems) {
    if (!it.equipmentId) continue;
    try {
      const eq = await prisma.equipment.findUnique({ where: { id: it.equipmentId }, select: { lastServiceDate: true } });
      if (eq && (!eq.lastServiceDate || eq.lastServiceDate < done)) {
        await prisma.equipment.update({ where: { id: it.equipmentId }, data: { lastServiceDate: done } });
      }
    } catch {
      /* best effort */
    }
  }

  // Servicing batch for the month
  try {
    let ext = 0, hose = 0, blanket = 0, detector = 0, other = 0;
    if (wo.inspectionItems.length) {
      for (const it of wo.inspectionItems) {
        if (it.category === 'FIRE_EXTINGUISHER') ext++;
        else if (it.category === 'HOSE_REEL') hose++;
        else if (it.category === 'FIRE_BLANKET') blanket++;
        else if (it.category === 'SMOKE_DETECTOR' || it.category === 'HEAT_DETECTOR') detector++;
        else other++;
      }
    } else if (Array.isArray(wo.serviceLines)) {
      for (const l of wo.serviceLines as any[]) {
        const k = countFromLabel(String(l.label ?? ''));
        const q = Number(l.quantity) || 0;
        if (k === 'ext') ext += q;
        else if (k === 'hose') hose += q;
        else if (k === 'blanket') blanket += q;
        else if (k === 'detector') detector += q;
      }
    }
    if (ext + hose + blanket + detector + other > 0) {
      const month = startOfMonth(new Date(Date.UTC(done.getUTCFullYear(), done.getUTCMonth(), 1)));
      const ym = `${done.getUTCFullYear()}-${String(done.getUTCMonth() + 1).padStart(2, '0')}`;
      const dedupeKey = `c:${wo.customerId}|${ym}`;
      const exists = await prisma.servicingBatch.findUnique({ where: { dedupeKey } });
      if (!exists) {
        const customer = await prisma.customer.findUnique({ where: { id: wo.customerId }, select: { displayName: true, address: true, phone: true } });
        await prisma.servicingBatch.create({
          data: {
            customerId: wo.customerId,
            clientName: customer?.displayName ?? 'Customer',
            address: customer?.address,
            phone: customer?.phone,
            batchMonth: new Date(Date.UTC(month.getFullYear(), month.getMonth(), 1)),
            serviceDate: done,
            nextDueDate: addMonths(done, 12),
            extinguishers: ext,
            hoseReels: hose,
            fireBlankets: blanket,
            detectors: detector,
            otherItems: other,
            source: 'APP',
            sourceRef: wo.woNumber,
            dedupeKey,
          },
        });
      }
    }
  } catch {
    /* batch recording is best effort */
  }
  return { certificateNumber: number, created: true };
}

export async function loadCertificateData(workOrderId: string): Promise<CertificateData | null> {
  const [wo, settings] = await Promise.all([
    prisma.workOrder.findUnique({
      where: { id: workOrderId },
      include: {
        customer: true,
        site: true,
        assignedTechnician: true,
        additionalTechnicians: { include: { technician: true } },
        inspectionItems: { include: { equipment: true }, orderBy: { createdAt: 'asc' } },
        invoice: { select: { invoiceNumber: true } },
      },
    }),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
  ]);
  if (!wo || !wo.certificateNumber) return null;
  const done = wo.completedAt ?? wo.certificateIssuedAt ?? new Date();
  const intervals = wo.inspectionItems.map((i) => i.equipment?.intervalMonths ?? 12);
  const interval = intervals.length ? Math.min(...intervals) : 12;

  const siteBits = [wo.site?.label, wo.site?.buildingName, wo.site?.address, wo.locationDetails].filter(Boolean);
  const items: CertificateItem[] = wo.inspectionItems.map((it, i) => ({
    no: i + 1,
    type: label(it.category),
    serial: it.serialNumber ?? it.equipment?.serialNumber ?? '',
    location: it.equipment?.locationDescription ?? '',
    result: it.passFail === 'PASS' ? 'PASS' : it.passFail === 'FAIL' ? 'FAIL' : 'N/A',
    notes: [it.replacementParts ? `Replaced: ${it.replacementParts}` : '', it.hydrostaticTestDone ? `Hydrostatic test${it.hydrostaticNotes ? ': ' + it.hydrostaticNotes : ' done'}` : '', it.notes ?? '']
      .filter(Boolean)
      .join('; '),
  }));
  const summary = Array.isArray(wo.serviceLines)
    ? (wo.serviceLines as any[]).filter((l) => Number(l.quantity) > 0).map((l) => ({ label: String(l.label), quantity: Number(l.quantity) }))
    : [];
  const techs = [wo.assignedTechnician?.name, ...wo.additionalTechnicians.map((t) => t.technician.name)].filter(Boolean) as string[];

  return {
    settings: documentSettings(settings),
    certificateNumber: wo.certificateNumber,
    workOrderNumber: wo.woNumber,
    invoiceNumber: wo.invoice?.invoiceNumber ?? wo.invoiceNumberIfIssued ?? null,
    serviceDate: formatDate(done),
    nextDueDate: formatDate(addMonths(done, interval)),
    customer: { displayName: wo.customer.displayName, address: wo.customer.address, phone: wo.customer.phone },
    siteAddress: siteBits.length ? siteBits.join(', ') : null,
    items,
    summary,
    technicians: techs,
    technicianNotes: wo.technicianNotes,
    customerSignedName: wo.customerSignedName,
    customerSignatureDataUrl: wo.customerSignatureDataUrl,
    declaration: CERTIFICATE_DECLARATION,
  };
}
