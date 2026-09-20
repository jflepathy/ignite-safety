import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { z } from 'zod';

const ServiceLineSchema = z.object({
  key: z.string(),
  label: z.string(),
  quantity: z.number().int().min(0),
  kind: z.enum(['STANDARD', 'CUSTOM', 'WORKSHOP']),
});

const Schema = z.object({
  customerSignedName: z.string().min(1),
  customerSignatureDataUrl: z.string().min(1),
  technicianNotes: z.string().optional(),
  serviceLines: z.array(ServiceLineSchema).optional(),
  invoiceNumberIfIssued: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireRole('ADMIN', 'TECHNICIAN');
  if (error) return error;

  const wo = await prisma.workOrder.findUnique({ where: { id: params.id } });
  if (!wo) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (session!.user.role === 'TECHNICIAN' && wo.assignedTechnicianId !== session!.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updated = await prisma.workOrder.update({
    where: { id: params.id },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      customerSignedName: parsed.data.customerSignedName,
      customerSignatureDataUrl: parsed.data.customerSignatureDataUrl,
      technicianNotes: parsed.data.technicianNotes,
      ...(parsed.data.serviceLines ? { serviceLines: parsed.data.serviceLines } : {}),
      ...(parsed.data.invoiceNumberIfIssued !== undefined ? { invoiceNumberIfIssued: parsed.data.invoiceNumberIfIssued } : {}),
    },
  });

  return NextResponse.json(updated);
}
