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

  const serviceRequest = await prisma.serviceRequest.create({
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
      equipmentCounts: {
        create: data.equipmentCounts
          .filter((ec) => ec.tentativeCount > 0)
          .map((ec) => ({ category: ec.category, tentativeCount: ec.tentativeCount })),
      },
    },
    include: { customer: true, equipmentCounts: true },
  });

  return NextResponse.json({ serviceRequest, availability }, { status: 201 });
}
