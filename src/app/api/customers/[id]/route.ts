import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, requireEdit } from '@/lib/api-auth';
import { z } from 'zod';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireRole('ADMIN', 'SALES', 'TECHNICIAN');
  if (error) return error;
  const customer = await prisma.customer.findUnique({ where: { id: params.id }, include: { sites: true } });
  if (!customer || customer.deletedAt) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(customer);
}

const UpdateSchema = z.object({
  displayName: z.string().min(1).optional(),
  type: z.enum(['INDIVIDUAL', 'COMPANY', 'GOVERNMENT']).optional(),
  contactPerson: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  altPhone: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal('')).nullable(),
  address: z.string().optional().nullable(),
  region: z.string().optional().nullable(),
  district: z.string().optional().nullable(),
  taxId: z.string().optional().nullable(),
  terms: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireEdit('customers', 'ADMIN', 'SALES');
  if (error) return error;
  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const customer = await prisma.customer.update({ where: { id: params.id }, data: parsed.data });
  return NextResponse.json(customer);
}

// Session 22, round 10 — soft-delete into the Recycle Bin (Settings >
// Recycle Bin), admin-only like the existing Invoice/WorkOrder DELETE
// handlers. Deliberately no hard delete and no block on related
// invoices/work orders/estimates: those keep their (already soft-deleted-
// filtered-out) customerId reference and still display the customer's
// name fine, since the row itself isn't removed, only flagged.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireRole('ADMIN');
  if (error) return error;
  const existing = await prisma.customer.findUnique({ where: { id: params.id } });
  if (!existing || existing.deletedAt) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await prisma.customer.update({ where: { id: params.id }, data: { deletedAt: new Date() } });
  await prisma.auditLog.create({
    data: {
      userId: session!.user.id,
      action: 'CUSTOMER_DELETED',
      entityType: 'Customer',
      entityId: params.id,
      metadata: { displayName: existing.displayName },
    },
  });
  return NextResponse.json({ ok: true });
}
