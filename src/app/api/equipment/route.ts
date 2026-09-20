import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  const { error } = await requireRole('ADMIN', 'SALES', 'TECHNICIAN');
  if (error) return error;
  const customerId = req.nextUrl.searchParams.get('customerId') || undefined;
  const equipment = await prisma.equipment.findMany({
    where: { deletedAt: null, ...(customerId ? { customerId } : {}) },
    include: { customer: true, site: true },
    orderBy: { createdAt: 'desc' },
    take: 300,
  });
  return NextResponse.json(equipment);
}

const CreateSchema = z.object({
  customerId: z.string().min(1),
  siteId: z.string().optional().nullable(),
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
  serialNumber: z.string().optional(),
  make: z.string().optional(),
  model: z.string().optional(),
  locationDescription: z.string().optional(),
  installDate: z.string().optional(),
  lastServiceDate: z.string().optional(),
  intervalMonths: z.number().int().positive().default(12),
});

export async function POST(req: NextRequest) {
  const { error } = await requireRole('ADMIN', 'SALES', 'TECHNICIAN');
  if (error) return error;
  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;
  const equipment = await prisma.equipment.create({
    data: {
      customerId: data.customerId,
      siteId: data.siteId || null,
      category: data.category,
      serialNumber: data.serialNumber,
      make: data.make,
      model: data.model,
      locationDescription: data.locationDescription,
      installDate: data.installDate ? new Date(data.installDate) : null,
      lastServiceDate: data.lastServiceDate ? new Date(data.lastServiceDate) : null,
      intervalMonths: data.intervalMonths,
    },
  });
  return NextResponse.json(equipment, { status: 201 });
}
