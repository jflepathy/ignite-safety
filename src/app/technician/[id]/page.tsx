import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import PosClient from '@/components/technician/pos-client';

export default async function TechnicianJobPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const wo = await prisma.workOrder.findUnique({
    where: { id: params.id },
    include: { customer: true, site: true },
  });
  if (!wo) notFound();
  if (session!.user.role === 'TECHNICIAN' && wo.assignedTechnicianId !== session!.user.id) {
    notFound();
  }

  return (
    <PosClient
      workOrder={{
        id: wo.id,
        woNumber: wo.woNumber,
        status: wo.status,
        serviceType: wo.serviceType,
        customerName: wo.customer.displayName,
        contactPerson: wo.customer.contactPerson,
        phone: wo.customer.phone,
        locationDetails: wo.locationDetails ?? wo.site?.buildingName ?? null,
        scheduledDate: wo.scheduledDate ? wo.scheduledDate.toISOString() : null,
        technicianNotes: wo.technicianNotes,
        serviceLines: (wo.serviceLines as any[]) ?? [],
        invoiceNumberIfIssued: wo.invoiceNumberIfIssued,
        customerSignedName: wo.customerSignedName,
        customerSignatureDataUrl: wo.customerSignatureDataUrl,
      }}
    />
  );
}
