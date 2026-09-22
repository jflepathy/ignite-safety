import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireEdit } from '@/lib/api-auth';
import { z } from 'zod';

// Header-field edits only — see the same note in bills/[id]/route.ts on
// why line items/amounts aren't part of this pass.
const UpdateSchema = z.object({
  expectedDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.enum(['DRAFT', 'OPEN', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED', 'CANCELLED']).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireEdit('purchaseOrders', 'ADMIN', 'SALES');
  if (error) return error;
  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { expectedDate, ...rest } = parsed.data;
  const data: Record<string, unknown> = { ...rest };
  if (expectedDate !== undefined) data.expectedDate = expectedDate ? new Date(expectedDate) : null;
  const po = await prisma.purchaseOrder.update({ where: { id: params.id }, data, include: { supplier: true, lineItems: true } });
  return NextResponse.json(po);
}
