import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { isStaleAssignment, canTechnicianAccess } from '@/lib/work-order-status';
import { logWorkOrderHistory } from '@/lib/work-order-history';
import { z } from 'zod';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireRole('ADMIN', 'SALES', 'TECHNICIAN');
  if (error) return error;

  const wo = await prisma.workOrder.findUnique({
    where: { id: params.id },
    include: {
      customer: true,
      site: true,
      assignedTechnician: true,
      inspectionItems: { include: { equipment: true } },
      invoice: true,
      serviceRequest: true,
      additionalTechnicians: true,
      ...(session!.user.role === 'ADMIN' ? { historyEntries: { orderBy: { createdAt: 'desc' as const } } } : {}),
    },
  });
  if (!wo) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  // A technician can open a job that's unassigned, already theirs (primary
  // or one of the additional technicians on it — Session 20), or has gone
  // stale (assigned to someone else but idle 4+ days) — see
  // work-order-status.ts.
  if (
    session!.user.role === 'TECHNICIAN' &&
    !canTechnicianAccess(wo, wo.additionalTechnicians.map((t) => t.technicianId), session!.user.id)
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return NextResponse.json(wo);
}

const ServiceLineSchema = z.object({
  key: z.string(),
  label: z.string(),
  quantity: z.number().int().min(0),
  kind: z.enum(['STANDARD', 'CUSTOM', 'WORKSHOP']),
});

const UpdateSchema = z.object({
  status: z.enum(['PENDING', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'PAST_DUE', 'CANCELLED']).optional(),
  scheduledDate: z.string().optional().nullable(),
  assignedTechnicianId: z.string().optional().nullable(),
  technicianNotes: z.string().optional(),
  locationDetails: z.string().optional(),
  serviceLines: z.array(ServiceLineSchema).optional(),
  invoiceNumberIfIssued: z.string().optional(),
  // Saved as progress (Session 11), not only on final Complete & Sync — a
  // technician can capture sign-off mid-job and keep working.
  customerSignedName: z.string().optional(),
  customerSignatureDataUrl: z.string().optional(),
  // Admin-only (enforced below, not by this schema): the full set of extra
  // technicians on this job beyond the primary assignedTechnicianId
  // (Session 20). Omit the field to leave additional technicians
  // untouched; pass [] to clear them all.
  additionalTechnicianIds: z.array(z.string()).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireRole('ADMIN', 'SALES', 'TECHNICIAN');
  if (error) return error;

  const existing = await prisma.workOrder.findUnique({ where: { id: params.id }, include: { additionalTechnicians: true } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const staleBefore = isStaleAssignment(existing);
  const existingAdditionalIds = existing.additionalTechnicians.map((t) => t.technicianId);
  if (
    session!.user.role === 'TECHNICIAN' &&
    !canTechnicianAccess(existing, existingAdditionalIds, session!.user.id)
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  // Technicians can't reassign a job away from themselves or hand it to
  // someone else — but they CAN claim a job by setting assignedTechnicianId
  // to their own id when it's currently unassigned OR stale (assigned to
  // someone else but idle 4+ days with no update — see work-order-status.ts;
  // Session 12). Claiming a stale job takes it away from whoever had it.
  const patch: any = { ...data };
  const claimingSelf =
    (existing.assignedTechnicianId === null || staleBefore) && patch.assignedTechnicianId === session!.user.id;
  if (session!.user.role === 'TECHNICIAN' && !claimingSelf) delete patch.assignedTechnicianId;
  if (patch.scheduledDate !== undefined) {
    patch.scheduledDate = patch.scheduledDate ? new Date(patch.scheduledDate) : null;
  }
  if (patch.status === 'IN_PROGRESS' && !existing.startedAt) {
    patch.startedAt = new Date();
  }

  // additionalTechnicianIds isn't a WorkOrder column — it's synced into the
  // WorkOrderTechnician join table separately below, admin-only (a
  // technician has no business adding coworkers to their own job).
  const nextAdditionalIds: string[] | undefined = patch.additionalTechnicianIds;
  delete patch.additionalTechnicianIds;
  if (nextAdditionalIds !== undefined && session!.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Plain update() + a separate include-fetch, not update({ include }) in
  // one call — writing assignedTechnicianId together with an `include` of
  // its own relation (assignedTechnician) makes Prisma verify the FK via
  // an implicit transaction, which the Neon HTTP adapter can't run
  // ("Transactions are not supported in HTTP mode"), same root cause as
  // the createMany/upsert/updateMany cases noted elsewhere in this file's
  // history. Splitting the write from the read avoids it (Session 11).
  await prisma.workOrder.update({ where: { id: params.id }, data: patch });

  // Sync additional technicians (Session 20) -- de-dupe, drop anyone who's
  // also the primary (they're already "on the job" via assignedTechnicianId
  // and would otherwise double-count in the incentive split), and never a
  // transaction/nested write, same adapter constraint as everywhere else:
  // delete the old rows, then create the new ones one at a time.
  let techniciansChanged = false;
  if (nextAdditionalIds !== undefined) {
    const finalAssignedId = patch.assignedTechnicianId !== undefined ? patch.assignedTechnicianId : existing.assignedTechnicianId;
    const deduped = [...new Set(nextAdditionalIds)].filter((id) => id !== finalAssignedId);
    const before = new Set(existingAdditionalIds);
    const after = new Set(deduped);
    techniciansChanged = before.size !== after.size || [...before].some((id) => !after.has(id));
    if (techniciansChanged) {
      await prisma.workOrderTechnician.deleteMany({ where: { workOrderId: params.id } });
      for (const technicianId of deduped) {
        await prisma.workOrderTechnician.create({ data: { workOrderId: params.id, technicianId } });
      }
    }
  }

  const updated = await prisma.workOrder.findUnique({
    where: { id: params.id },
    include: { customer: true, assignedTechnician: true, additionalTechnicians: { include: { technician: true } } },
  });

  // History logging (admin-visible only) — best-effort, after the real
  // write has already succeeded.
  if (patch.assignedTechnicianId !== undefined && patch.assignedTechnicianId !== existing.assignedTechnicianId) {
    const actorName = session!.user.name ?? session!.user.username ?? 'Someone';
    const newTechName = updated?.assignedTechnician?.name ?? 'Unassigned';
    let detail: string;
    if (claimingSelf && staleBefore) {
      detail = `${actorName} claimed this job (previously assigned, idle 4+ days) — now: ${newTechName}`;
    } else if (claimingSelf) {
      detail = `${actorName} claimed this unassigned job`;
    } else {
      detail = `${actorName} assigned this job to ${newTechName}`;
    }
    await logWorkOrderHistory({
      workOrderId: params.id,
      action: claimingSelf ? 'CLAIMED' : 'ASSIGNED',
      detail,
      byUserId: session!.user.id,
      byUserName: actorName,
    });
  }
  if (techniciansChanged) {
    const actorName = session!.user.name ?? session!.user.username ?? 'Someone';
    const names = (updated?.additionalTechnicians ?? []).map((t) => t.technician.name);
    const detail =
      names.length > 0
        ? `${actorName} set additional technicians on this job: ${names.join(', ')}`
        : `${actorName} removed all additional technicians from this job`;
    await logWorkOrderHistory({
      workOrderId: params.id,
      action: 'TECHNICIANS_CHANGED',
      detail,
      byUserId: session!.user.id,
      byUserName: actorName,
    });
  }
  if (patch.status !== undefined && patch.status !== existing.status) {
    const actorName = session!.user.name ?? session!.user.username ?? 'Someone';
    await logWorkOrderHistory({
      workOrderId: params.id,
      action: 'STATUS_CHANGED',
      detail: `${actorName} changed status: ${existing.status} → ${patch.status}`,
      byUserId: session!.user.id,
      byUserName: actorName,
    });
  }

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireRole('ADMIN', 'TECHNICIAN');
  if (error) return error;

  const existing = await prisma.workOrder.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (session!.user.role === 'TECHNICIAN' && existing.assignedTechnicianId !== null && existing.assignedTechnicianId !== session!.user.id && !isStaleAssignment(existing)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await prisma.workOrder.update({ where: { id: params.id }, data: { deletedAt: new Date() } });
  const actorName = session!.user.name ?? session!.user.username ?? 'Someone';
  await logWorkOrderHistory({
    workOrderId: params.id,
    action: 'DELETED',
    detail: `${actorName} deleted this work order`,
    byUserId: session!.user.id,
    byUserName: actorName,
  });
  return NextResponse.json({ ok: true });
}
