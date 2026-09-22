import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireEdit } from '@/lib/api-auth';
import { z } from 'zod';

// Header-field edits only (reference #, due date, terms, notes, status) —
// not the line items/amounts. A bill's subtotal/tax/total/balanceDue are
// tied to recorded SupplierPayments (balanceDue especially), and safely
// re-deriving all of that after a line-item change is a bigger, separate
// piece of work than this pass — see the architecture doc.
const UpdateSchema = z.object({
  supplierRef: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  terms: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.enum(['OPEN', 'PARTIAL', 'PAID', 'OVERDUE', 'VOID']).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireEdit('bills', 'ADMIN', 'SALES');
  if (error) return error;
  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { dueDate, ...rest } = parsed.data;
  const data: Record<string, unknown> = { ...rest };
  if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;
  // Plain update() + a separate include-fetch — update()+include in one
  // call needs an implicit transaction on this table's relations, which
  // the Neon HTTP adapter can't run ("Transactions are not supported in
  // HTTP mode"). Same fix as the other document PATCH routes.
  await prisma.bill.update({ where: { id: params.id }, data });
  const bill = await prisma.bill.findUnique({ where: { id: params.id }, include: { supplier: true, billLineItems: true } });
  return NextResponse.json(bill);
}
