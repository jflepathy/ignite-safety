import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const usernamePattern = /^[a-z0-9._-]{3,32}$/;

const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  username: z.string().regex(usernamePattern, 'Lowercase letters, numbers, dots, underscores or hyphens, 3-32 characters').optional(),
  email: z.string().email().optional(),
  role: z.enum(['ADMIN', 'SALES', 'TECHNICIAN']).optional(),
  active: z.boolean().optional(),
  phone: z.string().optional().nullable(),
  password: z.string().min(8).optional(), // set to reset the password
  unlock: z.boolean().optional(), // clear a lockout without changing the password
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireRole('ADMIN');
  if (error) return error;
  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { username, email, password, unlock, ...rest } = parsed.data;

  const data: Record<string, unknown> = { ...rest };
  if (username !== undefined) {
    const lower = username.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { username: lower } });
    if (existing && existing.id !== params.id) {
      return NextResponse.json({ error: { formErrors: ['That username is already taken.'] } }, { status: 400 });
    }
    data.username = lower;
  }
  if (email !== undefined) data.email = email.toLowerCase();
  if (password) data.passwordHash = await bcrypt.hash(password, 10);
  if (unlock) {
    data.failedLoginAttempts = 0;
    data.lockedUntil = null;
  }

  const user = await prisma.user.update({
    where: { id: params.id },
    data,
    select: { id: true, name: true, username: true, email: true, role: true, active: true, lockedUntil: true },
  });
  return NextResponse.json(user);
}
