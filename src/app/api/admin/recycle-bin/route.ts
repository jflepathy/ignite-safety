import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';

/**
 * Session 22, round 10 — Recycle Bin, admin-only (the user's own scoping:
 * "recyle bin UI -only for admin"). Lists every soft-deleted row across
 * the 6 models that carry a `deletedAt` column, newest-deleted first. Each
 * type includes just enough of its own relations to display a meaningful
 * row (customer name, amounts) without pulling full document bodies.
 */
export async function GET() {
  const { error } = await requireRole('ADMIN');
  if (error) return error;

  const [customers, suppliers, equipment, estimates, invoices, workOrders] = await Promise.all([
    prisma.customer.findMany({ where: { deletedAt: { not: null } }, orderBy: { deletedAt: 'desc' } }),
    prisma.supplier.findMany({ where: { deletedAt: { not: null } }, orderBy: { deletedAt: 'desc' } }),
    prisma.equipment.findMany({
      where: { deletedAt: { not: null } },
      include: { customer: true },
      orderBy: { deletedAt: 'desc' },
    }),
    prisma.estimate.findMany({
      where: { deletedAt: { not: null } },
      include: { customer: true },
      orderBy: { deletedAt: 'desc' },
    }),
    prisma.invoice.findMany({
      where: { deletedAt: { not: null } },
      include: { customer: true },
      orderBy: { deletedAt: 'desc' },
    }),
    prisma.workOrder.findMany({
      where: { deletedAt: { not: null } },
      include: { customer: true },
      orderBy: { deletedAt: 'desc' },
    }),
  ]);

  return NextResponse.json({ customers, suppliers, equipment, estimates, invoices, workOrders });
}
