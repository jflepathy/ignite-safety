import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { type AppRole } from '@/lib/roles';
import { canEditModule, type EditModuleKey } from '@/lib/edit-permissions-constants';

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

/**
 * Use at the top of an edit/create/delete handler for one of the
 * EDIT_MODULE_KEYS components (customers, chart of accounts, expense
 * transactions, suppliers, bills, purchase orders, products & services).
 * Admins always pass; a non-admin (Sales/Technician, whoever the module's
 * own view-level RBAC otherwise lets in) needs an explicit per-user edit
 * grant from Admin > Permissions. This is server-side enforcement — the
 * UI also hides/disables the edit controls, but that alone is never
 * trusted, since a client can always call the API directly.
 */
export async function requireEdit(moduleKey: EditModuleKey, ...viewRoles: AppRole[]) {
  const { session, error } = await requireRole(...viewRoles);
  if (error) return { session, error };
  const isAdmin = session!.user.role === 'ADMIN';
  if (!canEditModule(moduleKey, isAdmin, session!.user.editModules)) {
    return { session, error: NextResponse.json({ error: 'You do not have edit access to this — ask an admin to grant it in Settings > Users > Permissions.' }, { status: 403 }) };
  }
  return { session, error: null };
}
