import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

export async function GET() {
  const { error } = await requireRole('ADMIN');
  if (error) return error;
  const users = await prisma.user.findMany({
    select: { id: true, name: true, username: true, email: true, role: true, active: true, phone: true, createdAt: true, lockedUntil: true },
    orderBy: { createdAt: 'asc' },
  });
  return NextResponse.json(users);
}

const usernamePattern = /^[a-z0-9._-]{3,32}$/;

const CreateSchema = z.object({
  name: z.string().min(1),
  username: z.string().regex(usernamePattern, 'Lowercase letters, numbers, dots, underscores or hyphens, 3-32 characters'),
  // Login is by username, not email (Session 7), so email is optional —
  // e.g. a non-person assignment account ("Admin Ops") has no real inbox.
  // Still validated as a real email address when one is given.
  email: z.string().trim().email().optional().or(z.literal('')),
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

  const username = data.username.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) return NextResponse.json({ error: { formErrors: ['That username is already taken.'] } }, { status: 400 });

  const email = data.email ? data.email.toLowerCase() : null;
  if (email) {
    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) return NextResponse.json({ error: { formErrors: ['That email is already in use by another login.'] } }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(data.password, 10);
  const user = await prisma.user.create({
    data: {
      name: data.name,
      username,
      email,
      passwordHash,
      role: data.role,
      phone: data.phone,
    },
    select: { id: true, name: true, username: true, email: true, role: true, active: true },
  });
  return NextResponse.json(user, { status: 201 });
}
