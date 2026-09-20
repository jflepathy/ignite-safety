import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import AdminTabsClient from '@/components/admin/admin-tabs-client';
import BusinessSettingsForm from '@/components/admin/business-settings-form';
import SalesSettingsForm from '@/components/admin/sales-settings-form';
import MessagesRemindersForm from '@/components/admin/messages-reminders-form';
import ExpensesSettingsForm from '@/components/admin/expenses-settings-form';
import TimeTrackingSettingsForm from '@/components/admin/time-tracking-settings-form';
import AdvancedFinancialForm from '@/components/admin/advanced-financial-form';
import NumberingSettingsForm from '@/components/admin/numbering-settings-form';
import SchedulingSettingsForm from '@/components/admin/scheduling-settings-form';
import TaxFinancialSettingsForm from '@/components/admin/tax-financial-settings-form';
import UiModulesForm from '@/components/admin/ui-modules-form';
import BackupRestorePanel from '@/components/admin/backup-restore-panel';
import PermissionsManager from '@/components/admin/permissions-manager';
import MultiCurrencyForm from '@/components/admin/multi-currency-form';
import { serializePlain } from '@/lib/serialize';

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const [settingsRaw, taxRatesRaw] = await Promise.all([
    prisma.appSettings.findUnique({ where: { id: 1 } }),
    prisma.taxRate.findMany({ orderBy: { name: 'asc' } }),
  ]);
  // Decimal/Date fields must be plain strings before crossing into 'use
  // client' forms — see src/lib/serialize.ts for why (this was the actual
  // cause of the "unresponsive toggle buttons" bug on this page).
  const settings = settingsRaw ? serializePlain(settingsRaw) : null;
  const taxRates = serializePlain(taxRatesRaw);
  const tab = searchParams.tab ?? 'business';

  const tabGroups = [
    {
      heading: 'Company & Account Settings',
      tabs: [
        { key: 'business', label: 'Company Profile' },
        { key: 'sales', label: 'Sales Settings' },
        { key: 'messages', label: 'Messages & Reminders' },
        { key: 'expenses-settings', label: 'Expenses Settings' },
        { key: 'time-settings', label: 'Time Tracking' },
        { key: 'advanced', label: 'Advanced & Financial' },
        { key: 'numbering', label: 'Numbering' },
        { key: 'currency', label: 'Multi-Currency' },
      ],
    },
    {
      heading: 'Scheduling & Tax',
      tabs: [
        { key: 'scheduling', label: 'Scheduling & Dispatch' },
        { key: 'tax', label: 'Tax & Financial' },
      ],
    },
    {
      heading: 'Lists, Tools & Access',
      tabs: [
        { key: 'catalog', label: 'Equipment & Pricing Catalog' },
        { key: 'lists-tools', label: 'Lists & Tools' },
        { key: 'ui', label: 'UI Customization' },
        { key: 'users', label: 'Users' },
        { key: 'permissions', label: 'Access & Permissions' },
        { key: 'backup', label: 'Backup & Restore' },
      ],
    },
  ];

  const panels: Record<string, React.ReactNode> = {
    business: settings && <BusinessSettingsForm settings={settings as any} />,
    sales: settings && <SalesSettingsForm settings={settings as any} />,
    messages: settings && <MessagesRemindersForm settings={settings as any} />,
    'expenses-settings': settings && <ExpensesSettingsForm settings={settings as any} />,
    'time-settings': settings && <TimeTrackingSettingsForm settings={settings as any} />,
    advanced: settings && <AdvancedFinancialForm settings={settings as any} />,
    numbering: settings && <NumberingSettingsForm settings={settings as any} />,
    currency: settings && <MultiCurrencyForm settings={settings as any} />,
    scheduling: settings && <SchedulingSettingsForm settings={settings as any} />,
    tax: settings && <TaxFinancialSettingsForm settings={settings as any} taxRates={taxRates as any} />,
    catalog: <CatalogTabLink />,
    'lists-tools': <ListsToolsTabLink />,
    ui: settings && <UiModulesForm settings={settings as any} />,
    users: <UsersTabLink />,
    permissions: <PermissionsManager />,
    backup: <BackupRestorePanel />,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">Admin Settings</h1>
        <p className="text-sm text-slate-500">No-code configuration matrix — controls system behavior everywhere.</p>
      </div>

      <AdminTabsClient tabGroups={tabGroups} initialTab={tab} panels={panels} />
    </div>
  );
}

function CatalogTabLink() {
  return (
    <div className="card p-6">
      <p className="mb-3 text-sm text-slate-600">
        Manage the shop item catalog (unit prices, service charge templates) and safety equipment
        classifications from their dedicated screens.
      </p>
      <div className="flex gap-3">
        <Link href="/admin/catalog" className="btn-primary">
          Open Catalog Manager →
        </Link>
      </div>
    </div>
  );
}

function ListsToolsTabLink() {
  return (
    <div className="card p-6">
      <p className="mb-3 text-sm text-slate-600">Recurring transactions, attachments, custom fields, import/export and more.</p>
      <Link href="/admin/lists-tools" className="btn-primary">
        Open Lists &amp; Tools →
      </Link>
    </div>
  );
}

function UsersTabLink() {
  return (
    <div className="card p-6">
      <p className="mb-3 text-sm text-slate-600">Manage Admin, Sales and Technician accounts.</p>
      <Link href="/admin/users" className="btn-primary">
        Open User Management →
      </Link>
    </div>
  );
}
