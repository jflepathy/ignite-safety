import Link from 'next/link';

const READY = [
  { label: 'Products & Services', href: '/admin/catalog', desc: 'Manage the shop item catalog, pricing and tax defaults.' },
  { label: 'Chart of Accounts', href: '/accounting/chart-of-accounts', desc: 'Assets, liabilities, equity, income & expense accounts.' },
  { label: 'Audit Log', href: '/accounting/audit-log', desc: 'A record of key actions taken in the system.' },
  { label: 'Users', href: '/admin/users', desc: 'Manage user accounts and roles.' },
];

const COMING_SOON = [
  { label: 'Recurring Transactions', desc: 'Auto-generate invoices/bills on a schedule.' },
  { label: 'Attachments Library', desc: 'Browse every file attached across documents in one place.' },
  { label: 'Custom Fields', desc: 'Add your own fields to customers, invoices and more.' },
  { label: 'Rules & Workflows', desc: 'Automatically categorize transactions and trigger actions.' },
  { label: 'Reclassify Transactions', desc: 'Bulk-move transactions between accounts or classes.' },
  { label: 'Import / Export', desc: 'Bulk import customers, items and transactions from CSV.' },
  { label: 'Budgeting', desc: 'Set budgets by account and track variance.' },
  { label: 'Screen Sharing', desc: 'Live support sessions with an Ignite Safety specialist.' },
];

// Tier 1/2 items link to their real pages; Tier 3 items are listed and
// clearly marked "coming soon" per the tiered delivery plan.
export default function ListsAndToolsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">Lists & Tools</h1>
        <p className="text-sm text-slate-500">Cross-cutting configuration and utilities.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {READY.map((item) => (
          <Link key={item.label} href={item.href} className="card p-4 transition hover:border-brand-300">
            <p className="font-medium text-ink-900">{item.label}</p>
            <p className="mt-1 text-sm text-slate-500">{item.desc}</p>
          </Link>
        ))}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-ink-900">Coming Soon</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {COMING_SOON.map((item) => (
            <div key={item.label} className="card border-dashed p-4 opacity-70">
              <p className="font-medium text-ink-900">{item.label}</p>
              <p className="mt-1 text-sm text-slate-500">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
