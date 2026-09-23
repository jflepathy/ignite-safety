import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { nextDocumentNumber } from '@/lib/numbering';
import { logWorkOrderHistory } from '@/lib/work-order-history';
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
      // "Mine" includes being an admin-added additional technician on the
      // job, not just the primary assignedTechnicianId (Session 20).
      ...(mine || session!.user.role === 'TECHNICIAN'
        ? {
            OR: [
              { assignedTechnicianId: session!.user.id },
              { additionalTechnicians: { some: { technicianId: session!.user.id } } },
            ],
          }
        : {}),
    },
    include: { customer: true, site: true, assignedTechnician: true, inspectionItems: true, additionalTechnicians: { include: { technician: true } } },
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
  // Technicians can create an ad-hoc Work Order themselves for a job they're
  // doing on site that wasn't pre-scheduled by the office (Session 11).
  const { session, error } = await requireRole('ADMIN', 'SALES', 'TECHNICIAN');
  if (error) return error;
  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;
  const isTechnician = session!.user.role === 'TECHNICIAN';

  // A technician creating their own on-the-spot job is assigned to
  // themselves and starts already In Progress — there's no dispatch step.
  const assignedTechnicianId = isTechnician ? session!.user.id : data.assignedTechnicianId || null;

  const woNumber = await nextDocumentNumber('workOrderNextSeq', 'workOrderPrefix');
  // Plain create() + a separate include-fetch, not create({ include }) in
  // one call — writing customerId/assignedTechnicianId together with an
  // `include` of those same relations makes Prisma verify the FK via an
  // implicit transaction, which the Neon HTTP adapter can't run
  // ("Transactions are not supported in HTTP mode"), same root cause
  // documented on the PATCH handler in [id]/route.ts (Session 12).
  const created = await prisma.workOrder.create({
    data: {
      woNumber,
      customerId: data.customerId,
      siteId: data.siteId || null,
      serviceType: data.serviceType,
      status: isTechnician ? 'IN_PROGRESS' : assignedTechnicianId ? 'SCHEDULED' : 'PENDING',
      scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : isTechnician ? new Date() : null,
      startedAt: isTechnician ? new Date() : undefined,
      region: data.region,
      locationDetails: data.locationDetails,
      assignedTechnicianId,
    },
  });
  const workOrder = await prisma.workOrder.findUnique({ where: { id: created.id }, include: { customer: true } });

  const actorName = session!.user.name ?? session!.user.username ?? 'Someone';
  await logWorkOrderHistory({
    workOrderId: created.id,
    action: 'CREATED',
    detail: isTechnician
      ? `${actorName} created this job on site (auto-assigned to self)`
      : `${actorName} created this work order`,
    byUserId: session!.user.id,
    byUserName: actorName,
  });

  return NextResponse.json(workOrder, { status: 201 });
}
