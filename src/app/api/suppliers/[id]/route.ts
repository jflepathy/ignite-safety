import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireEdit, requireRole } from '@/lib/api-auth';
import { z } from 'zod';

const UpdateSchema = z.object({
  displayName: z.string().min(1).optional(),
  companyName: z.string().optional().nullable(),
  contactPerson: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  taxId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireEdit('suppliers', 'ADMIN', 'SALES');
  if (error) return error;
  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const supplier = await prisma.supplier.update({ where: { id: params.id }, data: parsed.data });
  return NextResponse.json(supplier);
}

// Session 22, round 10 — soft-delete into the Recycle Bin, admin-only. See
// the matching comment on customers/[id]/route.ts's DELETE handler.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireRole('ADMIN');
  if (error) return error;
  const existing = await prisma.supplier.findUnique({ where: { id: params.id } });
  if (!existing || existing.deletedAt) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await prisma.supplier.update({ where: { id: params.id }, data: { deletedAt: new Date() } });
  await prisma.auditLog.create({
    data: {
      userId: session!.user.id,
      action: 'SUPPLIER_DELETED',
      entityType: 'Supplier',
      entityId: params.id,
      metadata: { displayName: existing.displayName },
    },
  });
  return NextResponse.json({ ok: true });
}
