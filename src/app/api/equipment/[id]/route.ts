import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { z } from 'zod';

/**
 * Session 22, round 10 — a per-record route for Equipment didn't exist at
 * all before this (equipment is created via POST /api/equipment during
 * onboarding/servicing flows and otherwise only ever read in bulk). Added
 * only what the Recycle Bin needs: soft-delete into it, admin-only. See
 * the matching comment on customers/[id]/route.ts's DELETE handler.
 */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireRole('ADMIN');
  if (error) return error;
  const existing = await prisma.equipment.findUnique({ where: { id: params.id } });
  if (!existing || existing.deletedAt) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await prisma.equipment.update({ where: { id: params.id }, data: { deletedAt: new Date() } });
  await prisma.auditLog.create({
    data: {
      userId: session!.user.id,
      action: 'EQUIPMENT_DELETED',
      entityType: 'Equipment',
      entityId: params.id,
      metadata: { serialNumber: existing.serialNumber, category: existing.category },
    },
  });
  return NextResponse.json({ ok: true });
}

const PatchSchema = z.object({
  customerId: z.string().min(1).optional(),
  category: z
    .enum(['FIRE_EXTINGUISHER', 'HOSE_REEL', 'SUPPRESSION_SYSTEM', 'FIRE_BLANKET', 'LIFE_RAFT', 'SMOKE_DETECTOR', 'HEAT_DETECTOR', 'EMERGENCY_LIGHT', 'FIRE_ALARM_PANEL', 'OTHER'])
    .optional(),
  serialNumber: z.string().nullable().optional(),
  make: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  locationDescription: z.string().nullable().optional(),
  installDate: z.string().nullable().optional(),
  lastServiceDate: z.string().nullable().optional(),
  intervalMonths: z.number().int().positive().optional(),
  status: z.enum(['ACTIVE', 'DECOMMISSIONED']).optional(),
});

// Edit a piece of equipment (Session 23 — Equipment management page).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;
  const parsed = PatchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const existing = await prisma.equipment.findUnique({ where: { id: params.id } });
  if (!existing || existing.deletedAt) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const d = parsed.data;
  const blank = (v: string | null | undefined) => (v === undefined ? undefined : v && v.trim() ? v.trim() : null);
  const date = (v: string | null | undefined) => (v === undefined ? undefined : v ? new Date(v) : null);
  const updated = await prisma.equipment.update({
    where: { id: params.id },
    data: {
      customerId: d.customerId,
      category: d.category,
      serialNumber: blank(d.serialNumber),
      make: blank(d.make),
      model: blank(d.model),
      locationDescription: blank(d.locationDescription),
      installDate: date(d.installDate),
      lastServiceDate: date(d.lastServiceDate),
      intervalMonths: d.intervalMonths,
      status: d.status,
    },
  });
  await prisma.auditLog.create({
    data: {
      userId: session!.user.id,
      action: 'EQUIPMENT_UPDATED',
      entityType: 'Equipment',
      entityId: params.id,
      metadata: { fields: Object.keys(d) },
    },
  });
  return NextResponse.json(updated);
}
