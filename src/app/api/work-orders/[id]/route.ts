import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
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
    },
  });
  if (!wo) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (session!.user.role === 'TECHNICIAN' && wo.assignedTechnicianId !== session!.user.id) {
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
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireRole('ADMIN', 'SALES', 'TECHNICIAN');
  if (error) return error;

  const existing = await prisma.workOrder.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (session!.user.role === 'TECHNICIAN' && existing.assignedTechnicianId !== session!.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  // Technicians may only update status/notes on their own work order, not reassign.
  const patch: any = { ...data };
  if (session!.user.role === 'TECHNICIAN') {
    delete patch.assignedTechnicianId;
  }
  if (patch.scheduledDate !== undefined) {
    patch.scheduledDate = patch.scheduledDate ? new Date(patch.scheduledDate) : null;
  }
  if (patch.status === 'IN_PROGRESS' && !existing.startedAt) {
    patch.startedAt = new Date();
  }

  const updated = await prisma.workOrder.update({
    where: { id: params.id },
    data: patch,
    include: { customer: true, assignedTechnician: true },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireRole('ADMIN', 'TECHNICIAN');
  if (error) return error;

  const existing = await prisma.workOrder.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (session!.user.role === 'TECHNICIAN' && existing.assignedTechnicianId !== session!.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await prisma.workOrder.update({ where: { id: params.id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
