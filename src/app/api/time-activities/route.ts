import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { z } from 'zod';

export async function GET() {
  const { error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;
  const activities = await prisma.timeActivity.findMany({
    include: { employee: true },
    orderBy: { date: 'desc' },
    take: 200,
  });
  return NextResponse.json(activities);
}

const CreateSchema = z.object({
  employeeId: z.string().min(1),
  workOrderId: z.string().optional().nullable(),
  customerId: z.string().optional().nullable(),
  date: z.string().optional(),
  hours: z.number().positive(),
  billable: z.boolean().default(true),
  serviceDescription: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const { error } = await requireRole('ADMIN', 'SALES', 'TECHNICIAN');
  if (error) return error;
  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { date, ...rest } = parsed.data;
  const activity = await prisma.timeActivity.create({
    data: { ...rest, date: date ? new Date(date) : new Date() },
  });
  return NextResponse.json(activity, { status: 201 });
}
