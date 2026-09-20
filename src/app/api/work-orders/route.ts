import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { nextDocumentNumber } from '@/lib/numbering';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  const { session, error } = await requireRole('ADMIN', 'SALES', 'TECHNICIAN');
  if (error) return error;

  const status = req.nextUrl.searchParams.get('status') || undefined;
  const mine = req.nextUrl.searchParams.get('mine') === 'true';

  const workOrders = await prisma.workOrder.findMany({
    where: {
      deletedAt: null,
      ...(status ? { status: status as any } : {}),
      ...(mine || session!.user.role === 'TECHNICIAN' ? { assignedTechnicianId: session!.user.id } : {}),
    },
    include: { customer: true, site: true, assignedTechnician: true, inspectionItems: true },
    orderBy: { scheduledDate: 'asc' },
    take: 300,
  });
  return NextResponse.json(workOrders);
}

const CreateSchema = z.object({
  customerId: z.string().min(1),
  siteId: z.string().optional().nullable(),
  serviceType: z.enum(['ONSITE', 'WORKSHOP']),
  scheduledDate: z.string().optional(),
  region: z.string().optional(),
  locationDetails: z.string().optional(),
  assignedTechnicianId: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  const { error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;
  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  const woNumber = await nextDocumentNumber('workOrderNextSeq', 'workOrderPrefix');
  const workOrder = await prisma.workOrder.create({
    data: {
      woNumber,
      customerId: data.customerId,
      siteId: data.siteId || null,
      serviceType: data.serviceType,
      status: data.assignedTechnicianId ? 'SCHEDULED' : 'PENDING',
      scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : null,
      region: data.region,
      locationDetails: data.locationDetails,
      assignedTechnicianId: data.assignedTechnicianId || null,
    },
    include: { customer: true },
  });
  return NextResponse.json(workOrder, { status: 201 });
}
