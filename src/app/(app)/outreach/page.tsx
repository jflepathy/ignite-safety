import { prisma } from '@/lib/prisma';
import { computeOutreachList } from '@/lib/scheduling';
import OutreachClient from '@/components/outreach/outreach-client';

export default async function OutreachPage() {
  const [rows, customers, scheduledCount, technicians, pendingRequests, settings] = await Promise.all([
    computeOutreachList(),
    prisma.customer.findMany({
      where: { deletedAt: null },
      orderBy: { displayName: 'asc' },
      select: { id: true, displayName: true, phone: true, contactPerson: true, region: true, district: true, email: true, address: true },
    }),
    prisma.serviceRequest.count({ where: { status: 'SCHEDULED' } }),
    prisma.user.findMany({ where: { role: 'TECHNICIAN', active: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.serviceRequest.findMany({
      where: { status: { in: ['NEW', 'SCHEDULED'] } },
      include: { customer: true, equipmentCounts: true },
      orderBy: { proposedDate: 'asc' },
    }),
    prisma.appSettings.findUnique({ where: { id: 1 }, select: { companyAddress: true } }),
  ]);

  const serializedRows = rows.map((r) => ({
    ...r,
    lastServiceDate: r.lastServiceDate ? r.lastServiceDate.toISOString() : null,
    nextDueDate: r.nextDueDate.toISOString(),
  }));

  const serializedPending = pendingRequests.map((r) => ({
    id: r.id,
    requestNumber: r.requestNumber,
    customerName: r.customer.displayName,
    serviceType: r.serviceType,
    proposedDate: r.proposedDate.toISOString(),
    region: r.region,
    district: r.district,
    status: r.status,
    totalEquipment: r.equipmentCounts.reduce((s, c) => s + c.tentativeCount, 0),
  }));

  return (
    <OutreachClient
      customers={customers}
      initialRows={serializedRows}
      scheduledCount={scheduledCount}
      technicians={technicians}
      pendingRequests={serializedPending}
      workshopAddress={settings?.companyAddress ?? null}
    />
  );
}
