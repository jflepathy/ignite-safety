import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { z } from 'zod';

const RestoreSchema = z.object({
  type: z.enum(['customer', 'supplier', 'equipment', 'estimate', 'invoice', 'workOrder']),
  id: z.string().min(1),
});

/**
 * Session 22, round 10 — restores one record out of the Recycle Bin by
 * clearing deletedAt. Deliberately per-record (not bulk) to keep the
 * confirm step meaningful. A restored Invoice keeps the 'VOID' status its
 * own DELETE handler set — un-deleting isn't the same as un-voiding, so an
 * admin who wants it billable again has to change that explicitly, same
 * as they would for any other status change.
 */
export async function POST(req: NextRequest) {
  const { session, error } = await requireRole('ADMIN');
  if (error) return error;

  const body = await req.json();
  const parsed = RestoreSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { type, id } = parsed.data;

  let label = '';
  switch (type) {
    case 'customer': {
      const existing = await prisma.customer.findUnique({ where: { id } });
      if (!existing || !existing.deletedAt) return NextResponse.json({ error: 'Not in Recycle Bin.' }, { status: 404 });
      await prisma.customer.update({ where: { id }, data: { deletedAt: null } });
      label = existing.displayName;
      break;
    }
    case 'supplier': {
      const existing = await prisma.supplier.findUnique({ where: { id } });
      if (!existing || !existing.deletedAt) return NextResponse.json({ error: 'Not in Recycle Bin.' }, { status: 404 });
      await prisma.supplier.update({ where: { id }, data: { deletedAt: null } });
      label = existing.displayName;
      break;
    }
    case 'equipment': {
      const existing = await prisma.equipment.findUnique({ where: { id } });
      if (!existing || !existing.deletedAt) return NextResponse.json({ error: 'Not in Recycle Bin.' }, { status: 404 });
      await prisma.equipment.update({ where: { id }, data: { deletedAt: null } });
      label = existing.serialNumber ?? existing.category;
      break;
    }
    case 'estimate': {
      const existing = await prisma.estimate.findUnique({ where: { id } });
      if (!existing || !existing.deletedAt) return NextResponse.json({ error: 'Not in Recycle Bin.' }, { status: 404 });
      await prisma.estimate.update({ where: { id }, data: { deletedAt: null } });
      label = existing.estimateNumber;
      break;
    }
    case 'invoice': {
      const existing = await prisma.invoice.findUnique({ where: { id } });
      if (!existing || !existing.deletedAt) return NextResponse.json({ error: 'Not in Recycle Bin.' }, { status: 404 });
      await prisma.invoice.update({ where: { id }, data: { deletedAt: null } });
      label = existing.invoiceNumber;
      break;
    }
    case 'workOrder': {
      const existing = await prisma.workOrder.findUnique({ where: { id } });
      if (!existing || !existing.deletedAt) return NextResponse.json({ error: 'Not in Recycle Bin.' }, { status: 404 });
      await prisma.workOrder.update({ where: { id }, data: { deletedAt: null } });
      label = existing.woNumber;
      break;
    }
  }

  await prisma.auditLog.create({
    data: {
      userId: session!.user.id,
      action: `${type.toUpperCase()}_RESTORED`,
      entityType: type,
      entityId: id,
      metadata: { label },
    },
  });

  return NextResponse.json({ ok: true });
}
