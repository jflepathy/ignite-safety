// Pure constants and logic only — no `prisma` import. This file exists
// specifically so client components (like permissions-manager.tsx) can pull
// in MODULE_KEYS/MODULE_LABELS without transitively dragging Prisma's
// server-only client into the browser bundle. See src/lib/permissions.ts,
// which re-exports everything here for existing server-side importers, plus
// the DB-backed functions that belong only on the server.

// Matches the keys used by AppSettings.uiModules (the existing global,
// company-wide module toggles) and NAV_GROUPS in nav-config.ts. Per-staff
// overrides layer on top of those: uiModules OFF always wins (module is
// off for everyone); otherwise a user's own override (if any) wins;
// otherwise the base 3-role system (ROUTE_ACCESS in lib/roles.ts) applies
// unchanged. Admins are never restricted by overrides — an override can
// only narrow a non-admin's own access, never broaden it past what
// ROUTE_ACCESS already allows their role.
export const MODULE_KEYS = [
  'outreach',
  'workOrders',
  'billing',
  'accounting',
  'expenses',
  'customerHub',
  'team',
  'inventory',
  'tax',
  'marketing',
  'settings',
  'reports',
  'recycleBin',
  'historicalData',
] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

export const MODULE_LABELS: Record<ModuleKey, string> = {
  outreach: 'Outreach',
  workOrders: 'Work Orders',
  billing: 'Sales & Get Paid',
  accounting: 'Accounting',
  expenses: 'Expenses & Pay Bills',
  customerHub: 'Customer Hub',
  team: 'Team',
  inventory: 'Inventory',
  tax: 'Tax',
  marketing: 'Marketing',
  settings: 'Settings (Admin only)',
  reports: 'Reports',
  recycleBin: 'Recycle Bin',
  historicalData: 'Historical Data',
};

/** Resolve final visibility per module for one user, given the global
 * uiModules toggle map and that user's own overrides. Admins always see
 * everything the global toggle allows — overrides never apply to Admin. */
export function resolveModuleVisibility(
  uiModules: Record<string, boolean>,
  overrides: Partial<Record<string, boolean>>,
  isAdmin: boolean
): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const key of MODULE_KEYS) {
    const globalOn = uiModules[key] !== false;
    if (!globalOn) {
      out[key] = false;
    } else if (!isAdmin && key in overrides) {
      out[key] = !!overrides[key];
    } else {
      out[key] = true;
    }
  }
  return out;
}
