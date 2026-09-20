import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { z } from 'zod';

export async function GET() {
  const { error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;
  const opportunities = await prisma.opportunity.findMany({
    include: { customer: true, lead: true },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(opportunities);
}

const CreateSchema = z.object({
  name: z.string().min(1),
  customerId: z.string().optional().nullable(),
  leadId: z.string().optional().nullable(),
  stage: z.enum(['PROSPECTING', 'QUALIFICATION', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST']).default('PROSPECTING'),
  estimatedValue: z.number().nonnegative().default(0),
  probabilityPercent: z.number().min(0).max(100).default(50),
  expectedCloseDate: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const { error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;
  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { expectedCloseDate, ...rest } = parsed.data;
  const opp = await prisma.opportunity.create({
    data: { ...rest, expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null },
  });
  return NextResponse.json(opp, { status: 201 });
}
