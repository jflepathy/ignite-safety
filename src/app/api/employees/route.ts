import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { z } from 'zod';

export async function GET() {
  const { error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;
  const employees = await prisma.employee.findMany({ orderBy: { name: 'asc' } });
  return NextResponse.json(employees);
}

const CreateSchema = z.object({
  name: z.string().min(1),
  email: z.string().optional(),
  phone: z.string().optional(),
  jobTitle: z.string().optional(),
  department: z.string().optional(),
  hireDate: z.string().optional(),
  employmentType: z.string().optional(),
  contractEndDate: z.string().optional(),
  standardHoursPerWeek: z.number().nonnegative().optional(),
  payType: z.enum(['HOURLY', 'SALARY', 'MONTHLY']).default('MONTHLY'),
  payRate: z.number().nonnegative().optional(),
});

export async function POST(req: NextRequest) {
  const { error } = await requireRole('ADMIN');
  if (error) return error;
  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { hireDate, contractEndDate, ...rest } = parsed.data;
  const employee = await prisma.employee.create({
    data: {
      ...rest,
      hireDate: hireDate ? new Date(hireDate) : undefined,
      contractEndDate: contractEndDate ? new Date(contractEndDate) : undefined,
    },
  });
  return NextResponse.json(employee, { status: 201 });
}
