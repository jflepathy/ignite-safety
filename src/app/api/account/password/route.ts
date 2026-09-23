import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

// Self-service "change my own password" (Session 20) -- distinct from the
// admin-only reset in /api/users/[id], which lets an admin set anyone's
// password with no current-password check. This route is the opposite: any
// logged-in user (any role) may change ONLY their own password, and must
// prove they know the current one first.
const Schema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password.'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters.'),
});

export async function PATCH(req: NextRequest) {
  const { session, error } = await requireRole(); // any authenticated role
  if (error) return error;

  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { currentPassword, newPassword } = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: session!.user.id } });
  if (!user) return NextResponse.json({ error: { formErrors: ['User not found.'] } }, { status: 404 });

  const matches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!matches) {
    return NextResponse.json({ error: { formErrors: ['Current password is incorrect.'] } }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  // Plain update, no include -- keeps this adapter-safe (see the note in
  // src/app/api/invoices/[id]/payments/[paymentId]/confirm/route.ts for why
  // that matters on the Neon HTTP adapter).
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  return NextResponse.json({ ok: true });
}
