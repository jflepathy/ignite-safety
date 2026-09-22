import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { nextDocumentNumber } from '@/lib/numbering';
import { checkDateAvailability } from '@/lib/scheduling';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  const { error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;
  const status = req.nextUrl.searchParams.get('status') || undefined;
  const requests = await prisma.serviceRequest.findMany({
    where: status ? { status: status as any } : {},
    include: { customer: true, site: true, equipmentCounts: true },
    orderBy: { proposedDate: 'asc' },
    take: 200,
  });
  return NextResponse.json(requests);
}

const EquipmentCountSchema = z.object({
  category: z.enum([
    'FIRE_EXTINGUISHER',
    'HOSE_REEL',
    'SUPPRESSION_SYSTEM',
    'FIRE_BLANKET',
    'LIFE_RAFT',
    'SMOKE_DETECTOR',
    'EMERGENCY_LIGHT',
    'FIRE_ALARM_PANEL',
    'OTHER',
  ]),
  tentativeCount: z.number().int().min(0),
});

const CreateSchema = z.object({
  customerId: z.string().min(1),
  siteId: z.string().optional().nullable(),
  serviceType: z.enum(['ONSITE', 'WORKSHOP']),
  proposedDate: z.string(),
  region: z.string().optional(),
  district: z.string().optional(),
  locationDetails: z.string().optional(),
  notes: z.string().optional(),
  sourceEquipmentId: z.string().optional().nullable(),
  equipmentCounts: z.array(EquipmentCountSchema).default([]),
});

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;

  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  const proposedDate = new Date(data.proposedDate);
  const availability = await checkDateAvailability(proposedDate);

  const requestNumber = await nextDocumentNumber('serviceRequestNextSeq', 'serviceRequestPrefix');

  // Two-step create — the Neon HTTP adapter can't run the implicit
  // transaction a nested relational `create` normally needs (see the same
  // note in src/app/api/invoices/route.ts).
  const createdRequest = await prisma.serviceRequest.create({
    data: {
      requestNumber,
      customerId: data.customerId,
      siteId: data.siteId || null,
      serviceType: data.serviceType,
      proposedDate,
      region: data.region,
      district: data.district,
      locationDetails: data.locationDetails,
      notes: data.notes,
      sourceEquipmentId: data.sourceEquipmentId || null,
      status: availability.available ? 'NEW' : 'NEW',
      createdById: session!.user.id,
    },
  });

  // createMany() also requires a transaction under the Neon HTTP adapter
  // (confirmed by direct testing — not just nested `create`), so rows go
  // in one at a time.
  const nonZeroCounts = data.equipmentCounts.filter((ec) => ec.tentativeCount > 0);
  for (const ec of nonZeroCounts) {
    await prisma.serviceRequestEquipmentCount.create({
      data: {
        serviceRequestId: createdRequest.id,
        category: ec.category,
        tentativeCount: ec.tentativeCount,
      },
    });
  }

  const serviceRequest = await prisma.serviceRequest.findUnique({
    where: { id: createdRequest.id },
    include: { customer: true, equipmentCounts: true },
  });

  return NextResponse.json({ serviceRequest: serviceRequest ?? createdRequest, availability }, { status: 201 });
}
