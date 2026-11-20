import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { z } from 'zod';

/** Admin: close the books through a date (or reopen with null). */
const Schema = z.object({ closedThrough: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable() });

export async function PATCH(req: NextRequest) {
  const { session, error } = await requireRole('ADMIN');
  if (error) return error;
  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const before = await prisma.appSettings.findUnique({ where: { id: 1 }, select: { booksClosedThrough: true } });
  const value = parsed.data.closedThrough ? new Date(`${parsed.data.closedThrough}T00:00:00Z`) : null;
  await prisma.appSettings.update({ where: { id: 1 }, data: { booksClosedThrough: value } });
  try {
    await prisma.auditLog.create({
      data: {
        userId: session!.user.id,
        action: value ? 'BOOKS_CLOSED' : 'BOOKS_REOPENED',
        entityType: 'AppSettings',
        entityId: '1',
        metadata: { from: before?.booksClosedThrough ?? null, to: parsed.data.closedThrough },
      },
    });
  } catch {
    /* best effort */
  }
  return NextResponse.json({ ok: true, closedThrough: parsed.data.closedThrough });
}
