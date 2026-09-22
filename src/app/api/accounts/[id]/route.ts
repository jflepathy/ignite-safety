import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireEdit } from '@/lib/api-auth';
import { z } from 'zod';

// `type` (Asset/Liability/Equity/Income/Expense) is deliberately NOT
// editable here — changing it after journal lines/expenses/etc. already
// exist against the account would misclassify that history. Renaming,
// recoding, re-parenting and activating/deactivating are all safe.
const UpdateSchema = z.object({
  code: z.string().optional().nullable(),
  name: z.string().min(1).optional(),
  subtype: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  parentId: z.string().optional().nullable(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireEdit('chartOfAccounts', 'ADMIN', 'SALES');
  if (error) return error;
  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const account = await prisma.account.update({ where: { id: params.id }, data: parsed.data });
  return NextResponse.json(account);
}
