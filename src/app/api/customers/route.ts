import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  const { error } = await requireRole('ADMIN', 'SALES', 'TECHNICIAN');
  if (error) return error;

  const q = req.nextUrl.searchParams.get('q')?.trim();
  const customers = await prisma.customer.findMany({
    where: {
      deletedAt: null,
      ...(q
        ? {
            OR: [
              { displayName: { contains: q, mode: 'insensitive' } },
              { phone: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    include: { sites: true },
    orderBy: { displayName: 'asc' },
    take: 100,
  });
  return NextResponse.json(customers);
}

const CreateCustomerSchema = z.object({
  displayName: z.string().min(1),
  type: z.enum(['INDIVIDUAL', 'COMPANY', 'GOVERNMENT']).default('COMPANY'),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  altPhone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  region: z.string().optional(),
  district: z.string().optional(),
  taxId: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  // Technicians can add a brand-new customer on the spot when creating an
  // ad-hoc Work Order on site (Session 11).
  const { error } = await requireRole('ADMIN', 'SALES', 'TECHNICIAN');
  if (error) return error;

  const body = await req.json();
  const parsed = CreateCustomerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const customer = await prisma.customer.create({ data: parsed.data });
  return NextResponse.json(customer, { status: 201 });
}
