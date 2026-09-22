// Kept separate from lib/auth.ts so middleware.ts (Edge runtime) never pulls
// in bcryptjs, which relies on Node-only APIs.

export type AppRole = 'ADMIN' | 'SALES' | 'TECHNICIAN';

export const ROLE_HOME: Record<AppRole, string> = {
  ADMIN: '/outreach',
  SALES: '/outreach',
  TECHNICIAN: '/technician',
};

/** Route-prefix -> roles allowed. Checked in middleware.ts.
 * Admin: unrestricted. Sales: everything except /admin (global settings).
 * Technician: mobile POS only. */
export const ROUTE_ACCESS: { prefix: string; roles: AppRole[] }[] = [
  // More specific rules must come before the general '/admin' rule below —
  // ROUTE_ACCESS.find() in middleware.ts takes the first match. Products &
  // Services (admin/catalog) is listed in the Sales & Get Paid nav group
  // (nav-config.ts) and can be edited by a non-admin granted edit access
  // to it (see edit-permissions-constants.ts), so Sales needs to reach the
  // page at all, even though the rest of /admin stays Admin-only.
  { prefix: '/admin/catalog', roles: ['ADMIN', 'SALES'] },
  { prefix: '/admin', roles: ['ADMIN'] },
  { prefix: '/billing', roles: ['ADMIN', 'SALES'] },
  { prefix: '/outreach', roles: ['ADMIN', 'SALES'] },
  { prefix: '/customers', roles: ['ADMIN', 'SALES'] },
  { prefix: '/customer-hub', roles: ['ADMIN', 'SALES'] },
  { prefix: '/work-orders', roles: ['ADMIN', 'SALES'] },
  { prefix: '/accounting', roles: ['ADMIN', 'SALES'] },
  { prefix: '/expenses', roles: ['ADMIN', 'SALES'] },
  { prefix: '/team', roles: ['ADMIN', 'SALES'] },
  { prefix: '/inventory', roles: ['ADMIN', 'SALES'] },
  { prefix: '/tax', roles: ['ADMIN', 'SALES'] },
  { prefix: '/marketing', roles: ['ADMIN', 'SALES'] },
  { prefix: '/technician', roles: ['ADMIN', 'TECHNICIAN'] },
];

/** Module-key -> route prefix, used both by middleware.ts (per-staff-member
 * module denial, enforced at the Edge from the JWT's deniedModules claim)
 * and by lib/permissions.ts (sidebar visibility). Kept here, not in
 * lib/permissions.ts, so middleware.ts can import it without pulling in
 * Prisma. */
export const MODULE_ROUTE_PREFIX: Record<string, string> = {
  outreach: '/outreach',
  workOrders: '/work-orders',
  billing: '/billing',
  accounting: '/accounting',
  expenses: '/expenses',
  customerHub: '/customer-hub',
  team: '/team',
  inventory: '/inventory',
  tax: '/tax',
  marketing: '/marketing',
  settings: '/admin',
};
