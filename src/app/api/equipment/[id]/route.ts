import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';

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
