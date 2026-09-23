export type NavLeaf = { label: string; href: string; icon?: string };
export type NavGroup = { key: string; label: string; icon: string; items: NavLeaf[]; adminOnly?: boolean };

// The Ignite-specific servicing modules stay pinned at the top of the
// sidebar; everything below is the QuickBooks-style accounting/CRM shell.
export const PINNED_NAV: NavLeaf[] = [
  { label: 'Outreach', href: '/outreach', icon: '📣' },
  { label: 'Servicing Requests', href: '/outreach/requests', icon: '🗓️' },
  { label: 'Work Orders', href: '/work-orders', icon: '🧾' },
];

export const NAV_GROUPS: NavGroup[] = [
  {
    key: 'billing',
    label: 'Sales & Get Paid',
    icon: '💳',
    items: [
      { label: 'Overview', href: '/billing' },
      { label: 'Invoices', href: '/billing?tab=invoices' },
      { label: 'Estimates', href: '/billing?tab=estimates' },
      { label: 'Sales Receipts', href: '/billing/sales-receipts' },
      { label: 'Customers', href: '/customers' },
      { label: 'Products & Services', href: '/admin/catalog' },
      { label: 'Reports', href: '/billing/reports' },
    ],
  },
  {
    key: 'expenses',
    label: 'Expenses & Pay Bills',
    icon: '💸',
    items: [
      { label: 'Expense Transactions', href: '/expenses' },
      { label: 'Suppliers', href: '/expenses/suppliers' },
      { label: 'Bills', href: '/expenses/bills' },
      { label: 'Purchase Orders', href: '/expenses/purchase-orders' },
    ],
  },
  {
    key: 'accounting',
    label: 'Accounting',
    icon: '📚',
    items: [
      { label: 'Chart of Accounts', href: '/accounting/chart-of-accounts' },
      { label: 'Reconcile', href: '/accounting/reconcile' },
      { label: 'Journal Entries', href: '/accounting/journal-entries' },
      { label: 'Audit Log', href: '/accounting/audit-log' },
    ],
  },
  {
    key: 'customerHub',
    label: 'Customer Hub',
    icon: '🤝',
    items: [
      { label: 'Overview', href: '/customer-hub' },
      { label: 'Customers & Leads', href: '/customer-hub/leads' },
      { label: 'Opportunities', href: '/customer-hub/opportunities' },
    ],
  },
  {
    key: 'team',
    label: 'Team',
    icon: '👥',
    items: [
      { label: 'Employees', href: '/team/employees' },
      { label: 'Time Tracking', href: '/team/time-tracking' },
      { label: 'Incentive Rates', href: '/team/incentive-rates' },
    ],
  },
  {
    key: 'inventory',
    label: 'Inventory',
    icon: '📦',
    items: [
      { label: 'Inventory Items', href: '/inventory' },
      { label: 'Adjustments', href: '/inventory/adjustments' },
    ],
  },
  {
    key: 'tax',
    label: 'Tax',
    icon: '🧮',
    items: [{ label: 'Tax Center', href: '/tax' }],
  },
  {
    key: 'marketing',
    label: 'Marketing',
    icon: '📣',
    items: [{ label: 'Campaigns', href: '/marketing' }],
  },
  {
    key: 'settings',
    label: 'Settings',
    icon: '⚙️',
    adminOnly: true,
    items: [
      { label: 'Company & Account', href: '/admin' },
      { label: 'Lists & Tools', href: '/admin/lists-tools' },
      { label: 'Users', href: '/admin/users' },
    ],
  },
];

export type CreateAction = { label: String; href: string };
export type CreateGroup = { heading: string; items: { label: string; href: string }[] };

export const CREATE_MENU: CreateGroup[] = [
  {
    heading: 'Customers / Sales',
    items: [
      { label: 'Invoice', href: '/billing/invoices/new' },
      { label: 'Receive payment', href: '/billing/receive-payment' },
      { label: 'Statement', href: '/customers' },
      { label: 'Estimate', href: '/billing/estimates/new' },
      { label: 'Credit note', href: '/billing/credit-notes/new' },
      { label: 'Sales receipt', href: '/billing/sales-receipts/new' },
      { label: 'Refund receipt', href: '/billing/refund-receipts/new' },
    ],
  },
  {
    heading: 'Suppliers / Expenses',
    items: [
      { label: 'Expense', href: '/expenses/new' },
      { label: 'Bill', href: '/expenses/bills/new' },
      { label: 'Pay bills', href: '/expenses/bills' },
      { label: 'Purchase order', href: '/expenses/purchase-orders/new' },
      { label: 'Supplier credit', href: '/expenses/suppliers' },
    ],
  },
  {
    heading: 'Team / Payroll',
    items: [
      { label: 'Single time activity', href: '/team/time-tracking/new' },
      { label: 'Timesheet', href: '/team/time-tracking' },
    ],
  },
  {
    heading: 'Other / General',
    items: [
      { label: 'Bank deposit', href: '/accounting/deposits/new' },
      { label: 'Transfer', href: '/accounting/transfers/new' },
      { label: 'Journal entry', href: '/accounting/journal-entries/new' },
      { label: 'Inventory adjustment', href: '/inventory/adjustments/new' },
    ],
  },
];
