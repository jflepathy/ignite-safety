import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { type AppRole } from '@/lib/roles';

/**
 * Use at the top of any API route handler to enforce RBAC.
 * Returns either { session } on success or { error } (a NextResponse to
 * return immediately) on failure.
 */
export async function requireRole(...roles: AppRole[]) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return { session: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  if (roles.length > 0 && !roles.includes(session.user.role)) {
    return { session, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { session, error: null };
}
