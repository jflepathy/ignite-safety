import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { canTechnicianAccess } from '@/lib/work-order-status';
import { logWorkOrderHistory } from '@/lib/work-order-history';
import { z } from 'zod';

const ServiceLineSchema = z.object({
  key: z.string(),
  label: z.string(),
  quantity: z.number().int().min(0),
  kind: z.enum(['STANDARD', 'CUSTOM', 'WORKSHOP']),
});

// Customer name/signature are validated conditionally below, against the
// admin-controlled AppSettings.requireCustomerSignoff toggle — the server
// is the source of truth, not just the POS UI's own check (Session 12).
const Schema = z.object({
  customerSignedName: z.string().optional(),
  customerSignatureDataUrl: z.string().optional(),
  technicianNotes: z.string().optional(),
  serviceLines: z.array(ServiceLineSchema).optional(),
  invoiceNumberIfIssued: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireRole('ADMIN', 'TECHNICIAN');
  if (error) return error;

  const wo = await prisma.workOrder.findUnique({ where: { id: params.id }, include: { additionalTechnicians: true } });
  if (!wo) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (
    session!.user.role === 'TECHNICIAN' &&
    !canTechnicianAccess(wo, wo.additionalTechnicians.map((t) => t.technicianId), session!.user.id)
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Admin can always complete without a customer sign-off — the toggle
  // below only governs whether TECHNICIANS are required to capture one
  // (Session 12).
  if (session!.user.role !== 'ADMIN') {
    const appSettings = await prisma.appSettings.findUnique({ where: { id: 1 }, select: { requireCustomerSignoff: true } });
    if ((appSettings?.requireCustomerSignoff ?? true) && (!parsed.data.customerSignedName || !parsed.data.customerSignatureDataUrl)) {
      return NextResponse.json(
        { error: { formErrors: ['Customer name and signature are both required before completing.'] } },
        { status: 400 }
      );
    }
  }

  const updated = await prisma.workOrder.update({
    where: { id: params.id },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      // A technician completing a stale (previously someone else's) job
      // finishes claiming it in the same step.
      ...(session!.user.role === 'TECHNICIAN' ? { assignedTechnicianId: session!.user.id } : {}),
      customerSignedName: parsed.data.customerSignedName,
      customerSignatureDataUrl: parsed.data.customerSignatureDataUrl,
      technicianNotes: parsed.data.technicianNotes,
      ...(parsed.data.serviceLines ? { serviceLines: parsed.data.serviceLines } : {}),
      ...(parsed.data.invoiceNumberIfIssued !== undefined ? { invoiceNumberIfIssued: parsed.data.invoiceNumberIfIssued } : {}),
    },
  });

  const actorName = session!.user.name ?? session!.user.username ?? 'Someone';
  await logWorkOrderHistory({
    workOrderId: params.id,
    action: 'COMPLETED',
    detail: `${actorName} completed & synced this work order`,
    byUserId: session!.user.id,
    byUserName: actorName,
  });

  return NextResponse.json(updated);
}
