import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { isStaleAssignment } from '@/lib/work-order-status';
import { z } from 'zod';

const Schema = z.object({
  equipmentId: z.string().optional().nullable(),
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
  passFail: z.enum(['PASS', 'FAIL', 'NA']).default('NA'),
  replacementParts: z.string().optional(),
  hydrostaticTestDone: z.boolean().default(false),
  hydrostaticNotes: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireRole('ADMIN', 'TECHNICIAN');
  if (error) return error;

  const wo = await prisma.workOrder.findUnique({ where: { id: params.id } });
  if (!wo) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (session!.user.role === 'TECHNICIAN' && wo.assignedTechnicianId !== null && wo.assignedTechnicianId !== session!.user.id && !isStaleAssignment(wo)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const item = await prisma.workOrderInspectionItem.create({
    data: { workOrderId: params.id, ...parsed.data },
  });

  // Keep the equipment record's lastServiceDate current so the outreach
  // dashboard's predictive due-date calculation reflects this visit.
  if (parsed.data.equipmentId) {
    await prisma.equipment.update({
      where: { id: parsed.data.equipmentId },
      data: { lastServiceDate: new Date() },
    });
  }

  return NextResponse.json(item, { status: 201 });
}
