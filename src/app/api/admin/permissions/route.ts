import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { z } from 'zod';

export async function GET() {
  const { error } = await requireRole('ADMIN');
  if (error) return error;
  const [users, overrides] = await Promise.all([
    prisma.user.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.userPermissionOverride.findMany(),
  ]);
  return NextResponse.json({
    users: users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role })),
    overrides,
  });
}

const SetSchema = z.object({
  userId: z.string(),
  moduleKey: z.string(),
  allowed: z.boolean().nullable(), // null = remove the override, fall back to role default
});

export async function PUT(req: NextRequest) {
  const { session, error } = await requireRole('ADMIN');
  if (error) return error;
  const body = await req.json();
  const parsed = SetSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { userId, moduleKey, allowed } = parsed.data;

  if (allowed === null) {
    await prisma.userPermissionOverride.deleteMany({ where: { userId, moduleKey } });
  } else {
    // Sequential find-then-write instead of upsert() — the Neon HTTP driver
    // adapter (used so this runs on Cloudflare Workers) doesn't support the
    // implicit transaction Prisma wraps upsert() in.
    const existingOverride = await prisma.userPermissionOverride.findUnique({
      where: { userId_moduleKey: { userId, moduleKey } },
    });
    if (existingOverride) {
      await prisma.userPermissionOverride.update({
        where: { userId_moduleKey: { userId, moduleKey } },
        data: { allowed },
      });
    } else {
      await prisma.userPermissionOverride.create({ data: { userId, moduleKey, allowed } });
    }
  }

  await prisma.auditLog.create({
    data: {
      userId: session!.user.id,
      action: 'PERMISSION_OVERRIDE_SET',
      entityType: 'User',
      entityId: userId,
      metadata: { moduleKey, allowed },
    },
  });

  return NextResponse.json({ ok: true });
}
