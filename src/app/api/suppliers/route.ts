import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  const { error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;
  const q = req.nextUrl.searchParams.get('q')?.trim();
  const suppliers = await prisma.supplier.findMany({
    where: {
      deletedAt: null,
      ...(q ? { displayName: { contains: q, mode: 'insensitive' } } : {}),
    },
    orderBy: { displayName: 'asc' },
  });
  return NextResponse.json(suppliers);
}

const CreateSchema = z.object({
  displayName: z.string().min(1),
  companyName: z.string().optional(),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  taxId: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const { error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;
  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const supplier = await prisma.supplier.create({ data: parsed.data });
  return NextResponse.json(supplier, { status: 201 });
}
