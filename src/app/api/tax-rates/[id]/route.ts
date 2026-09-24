import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { z } from 'zod';

const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  ratePercent: z.number().min(0).max(100).optional(),
  isDefault: z.boolean().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireRole('ADMIN');
  if (error) return error;
  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  if (parsed.data.isDefault) {
    // Session 22, round 10 — this was already a "sequential, not a
    // transaction" comment, but updateMany() ITSELF turned out to still
    // need one under this Prisma version's query engine (confirmed via
    // direct testing: even a standalone updateMany() throws "Transactions
    // are not supported in HTTP mode") — so this was silently 500ing too.
    // Switched to per-row update() calls, which are genuinely single
    // statements.
    const currentDefaults = await prisma.taxRate.findMany({ where: { isDefault: true, NOT: { id: params.id } } });
    for (const tr of currentDefaults) {
      await prisma.taxRate.update({ where: { id: tr.id }, data: { isDefault: false } });
    }
  }

  const rate = await prisma.taxRate.update({ where: { id: params.id }, data: parsed.data });
  return NextResponse.json(rate);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireRole('ADMIN');
  if (error) return error;
  // Soft-delete (active: false) rather than a hard delete — historical
  // invoices/estimates/etc. reference tax rates by id via a required
  // foreign key, so removing the row outright would break that history.
  // An inactive rate simply stops appearing as a choice on new documents.
  const existing = await prisma.taxRate.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (existing.isDefault) {
    return NextResponse.json({ error: 'Cannot delete the default tax rate — set another rate as default first.' }, { status: 400 });
  }
  const rate = await prisma.taxRate.update({ where: { id: params.id }, data: { active: false } });
  return NextResponse.json(rate);
}
