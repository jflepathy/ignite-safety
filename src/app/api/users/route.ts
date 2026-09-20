import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

export async function GET() {
  const { error } = await requireRole('ADMIN');
  if (error) return error;
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, active: true, phone: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  return NextResponse.json(users);
}

const CreateSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['ADMIN', 'SALES', 'TECHNICIAN']),
  phone: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const { error } = await requireRole('ADMIN');
  if (error) return error;
  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  const passwordHash = await bcrypt.hash(data.password, 10);
  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email.toLowerCase(),
      passwordHash,
      role: data.role,
      phone: data.phone,
    },
    select: { id: true, name: true, email: true, role: true, active: true },
  });
  return NextResponse.json(user, { status: 201 });
}
