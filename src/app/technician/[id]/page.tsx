import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import PosClient from '@/components/technician/pos-client';
import { isStaleAssignment, canTechnicianAccess } from '@/lib/work-order-status';

export default async function TechnicianJobPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const [wo, settings] = await Promise.all([
    prisma.workOrder.findUnique({
      where: { id: params.id },
      include: { customer: true, site: true, additionalTechnicians: true },
    }),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
  ]);
  if (!wo) notFound();
  const stale = isStaleAssignment(wo);
  const additionalTechnicianIds = wo.additionalTechnicians.map((t) => t.technicianId);
  // A job is open to any technician when it's unassigned, already theirs
  // (primary or one of the additional technicians on it — Session 20), or
  // has gone stale (assigned to someone else but idle 4+ days — see
  // work-order-status.ts). Admin preview always gets in (Session 11/12).
  if (session!.user.role === 'TECHNICIAN' && !canTechnicianAccess(wo, additionalTechnicianIds, session!.user.id)) {
    notFound();
  }

  const extinguishers = await prisma.equipment.findMany({
    where: { customerId: wo.customerId, category: 'FIRE_EXTINGUISHER', status: 'ACTIVE', deletedAt: null },
    select: { id: true, serialNumber: true, make: true, model: true, locationDescription: true, lastServiceDate: true },
    orderBy: [{ locationDescription: 'asc' }, { serialNumber: 'asc' }],
    take: 300,
  });

  const isAdminPreview = session!.user.role === 'ADMIN';
  const claimForTechnicianId =
    session!.user.role === 'TECHNICIAN' && (wo.assignedTechnicianId === null || stale) && wo.assignedTechnicianId !== session!.user.id
      ? session!.user.id
      : undefined;

  return (
    <PosClient
      backHref={isAdminPreview ? '/work-orders' : '/technician'}
      claimForTechnicianId={claimForTechnicianId}
      isAdminPreview={isAdminPreview}
      extinguishers={extinguishers.map((e) => ({
        id: e.id,
        serialNumber: e.serialNumber,
        description: [e.make, e.model].filter(Boolean).join(' ') || null,
        location: e.locationDescription,
        lastServiceDate: e.lastServiceDate ? e.lastServiceDate.toISOString() : null,
      }))}
      workOrder={{
        id: wo.id,
        woNumber: wo.woNumber,
        status: wo.status,
        serviceType: wo.serviceType,
        customerName: wo.customer.displayName,
        customerAddress: wo.customer.address,
        contactPerson: wo.customer.contactPerson,
        phone: wo.customer.phone,
        locationDetails: wo.locationDetails ?? wo.site?.buildingName ?? null,
        scheduledDate: wo.scheduledDate ? wo.scheduledDate.toISOString() : null,
        technicianNotes: wo.technicianNotes,
        serviceLines: (wo.serviceLines as any[]) ?? [],
        invoiceNumberIfIssued: wo.invoiceNumberIfIssued,
        invoiceId: wo.invoiceId,
        customerSignedName: wo.customerSignedName,
        customerSignatureDataUrl: wo.customerSignatureDataUrl,
      }}
      settings={{
        companyName: settings?.companyName ?? 'Ignite Safety',
        companyAddress: settings?.companyAddress ?? null,
        companyPhone: settings?.companyPhone ?? null,
        logoUrl: settings?.logoUrl ?? null,
        requireCustomerSignoff: settings?.requireCustomerSignoff ?? true,
      }}
    />
  );
}
