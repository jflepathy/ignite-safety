import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { z } from 'zod';

const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  jobTitle: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  hireDate: z.string().optional().nullable(),
  employmentType: z.string().optional().nullable(),
  contractEndDate: z.string().optional().nullable(),
  standardHoursPerWeek: z.number().nonnegative().optional().nullable(),
  payType: z.enum(['HOURLY', 'SALARY', 'MONTHLY']).optional(),
  payRate: z.number().nonnegative().optional().nullable(),
  active: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireRole('ADMIN');
  if (error) return error;
  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { hireDate, contractEndDate, ...rest } = parsed.data;
  const data: Record<string, unknown> = { ...rest };
  if (hireDate !== undefined) data.hireDate = hireDate ? new Date(hireDate) : null;
  if (contractEndDate !== undefined) data.contractEndDate = contractEndDate ? new Date(contractEndDate) : null;

  const employee = await prisma.employee.update({ where: { id: params.id }, data });
  return NextResponse.json(employee);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireRole('ADMIN');
  if (error) return error;
  // Soft-deactivate rather than hard-delete — an employee may be referenced
  // by historical TimeActivity rows, and deactivating (rather than removing)
  // keeps that history intact while taking them off the active roster.
  const employee = await prisma.employee.update({ where: { id: params.id }, data: { active: false } });
  return NextResponse.json(employee);
}
