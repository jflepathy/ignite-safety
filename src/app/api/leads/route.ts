import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { z } from 'zod';

export async function GET() {
  const { error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;
  const leads = await prisma.lead.findMany({ include: { opportunities: true }, orderBy: { createdAt: 'desc' } });
  return NextResponse.json(leads);
}

const CreateSchema = z.object({
  name: z.string().min(1),
  companyName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  source: z.string().optional(),
  status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'UNQUALIFIED', 'CONVERTED']).default('NEW'),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const { error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;
  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const lead = await prisma.lead.create({ data: parsed.data });
  return NextResponse.json(lead, { status: 201 });
}
