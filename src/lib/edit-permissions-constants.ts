// Pure constants and logic only — no `prisma` import — same reasoning as
// permissions-constants.ts: client components (the Permissions Manager)
// need these without pulling Prisma into the browser bundle.
//
// This is a SEPARATE, narrower permission dimension from MODULE_KEYS in
// permissions-constants.ts. That one controls whether a user can *see* a
// whole sidebar section (view). This one controls whether a non-admin user
// can *edit records* in one of a specific set of components that are
// otherwise view-only for non-admins by default — deny-by-default, opt-in
// per user, per the go-live request: "editable for admin and any other
// user chosen ... selectable in settings for different users."
export const EDIT_MODULE_KEYS = [
  'customers',
  'chartOfAccounts',
  'expenseTransactions',
  'suppliers',
  'bills',
  'purchaseOrders',
  'productsServices',
] as const;
export type EditModuleKey = (typeof EDIT_MODULE_KEYS)[number];

export const EDIT_MODULE_LABELS: Record<EditModuleKey, string> = {
  customers: 'Customer Details',
  chartOfAccounts: 'Chart of Accounts',
  expenseTransactions: 'Expense Transactions',
  suppliers: 'Suppliers',
  bills: 'Bills',
  purchaseOrders: 'Purchase Orders',
  productsServices: 'Products & Services',
};

/** True if this user (admin, or explicitly granted via override) may edit
 * records in the given component. Non-admins get NO edit access by default
 * — an override here is a grant, not a restriction, unlike the view
 * overrides in permissions-constants.ts. */
export function canEditModule(
  moduleKey: EditModuleKey,
  isAdmin: boolean,
  editModules: string[] | undefined
): boolean {
  if (isAdmin) return true;
  return !!editModules?.includes(moduleKey);
}
