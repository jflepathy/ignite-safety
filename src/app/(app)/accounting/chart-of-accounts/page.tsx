import { prisma } from '@/lib/prisma';
import QuickAddButton from '@/components/shared/quick-add-button';

const TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'];

export default async function ChartOfAccountsPage() {
  const accounts = await prisma.account.findMany({ orderBy: { code: 'asc' } });

  const grouped = TYPES.map((type) => ({ type, accounts: accounts.filter((a) => a.type === type) }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Chart of Accounts</h1>
          <p className="text-sm text-slate-500">The full list of accounts your books post to.</p>
        </div>
        <QuickAddButton
          label="+ New Account"
          title="New Account"
          apiUrl="/api/accounts"
          fields={[
            { key: 'code', label: 'Account Code' },
            { key: 'name', label: 'Name', required: true },
            {
              key: 'type',
              label: 'Type',
              type: 'select',
              options: TYPES.map((t) => ({ value: t, label: t })),
              defaultValue: 'EXPENSE',
            },
            { key: 'subtype', label: 'Subtype' },
            { key: 'description', label: 'Description', type: 'textarea' },
          ]}
        />
      </div>

      <div className="space-y-6">
        {grouped.map((g) => (
          <div key={g.type} className="card overflow-x-auto">
            <div className="border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-ink-900">{g.type}</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
                  <th className="px-4 py-2">Code</th>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Subtype</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {g.accounts.map((a) => (
                  <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-2 text-slate-500">{a.code ?? '—'}</td>
                    <td className="px-4 py-2 font-medium text-ink-900">{a.name}</td>
                    <td className="px-4 py-2 text-slate-500">{a.subtype ?? '—'}</td>
                    <td className="px-4 py-2 text-slate-500">{a.isActive ? 'Active' : 'Inactive'}</td>
                  </tr>
                ))}
                {g.accounts.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                      No {g.type.toLowerCase()} accounts yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
