import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { nextDocumentNumber } from '@/lib/numbering';

// Converts a New Servicing Request into a scheduled Work Order (Module B -> Module C handoff).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  const assignedTechnicianId: string | undefined = body?.assignedTechnicianId || undefined;

  const sr = await prisma.serviceRequest.findUnique({ where: { id: params.id } });
  if (!sr) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (sr.status === 'CONVERTED') return NextResponse.json({ error: 'Already converted' }, { status: 409 });

  const woNumber = await nextDocumentNumber('workOrderNextSeq', 'workOrderPrefix');

  const workOrder = await prisma.workOrder.create({
    data: {
      woNumber,
      customerId: sr.customerId,
      siteId: sr.siteId,
      serviceRequestId: sr.id,
      serviceType: sr.serviceType,
      status: 'SCHEDULED',
      scheduledDate: sr.proposedDate,
      region: sr.region,
      locationDetails: sr.locationDetails,
      assignedTechnicianId: assignedTechnicianId || undefined,
    },
  });

  await prisma.serviceRequest.update({ where: { id: sr.id }, data: { status: 'CONVERTED' } });

  return NextResponse.json(workOrder, { status: 201 });
}
