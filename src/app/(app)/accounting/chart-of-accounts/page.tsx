import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { canEditModule } from '@/lib/edit-permissions-constants';
import QuickAddButton from '@/components/shared/quick-add-button';
import QuickEditButton from '@/components/shared/quick-edit-button';
import RemoveDepositAccountButton from '@/components/accounting/remove-deposit-account-button';

const TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'];

export default async function ChartOfAccountsPage() {
  const [accounts, session, settings] = await Promise.all([
    prisma.account.findMany({ orderBy: { code: 'asc' }, include: { bankAccount: true } }),
    getServerSession(authOptions),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
  ]);
  const isAdmin = session?.user.role === 'ADMIN';
  const canEdit = canEditModule('chartOfAccounts', isAdmin, session?.user.editModules);
  const currencyCode = settings?.currencyCode ?? 'SCR';

  const grouped = TYPES.map((type) => ({ type, accounts: accounts.filter((a) => a.type === type) }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Chart of Accounts</h1>
          <p className="text-sm text-slate-500">The full list of accounts your books post to.</p>
        </div>
        {isAdmin && (
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
        )}
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
                  {canEdit && <th className="px-4 py-2"></th>}
                </tr>
              </thead>
              <tbody>
                {g.accounts.map((a) => (
                  <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-2 text-slate-500">{a.code ?? '—'}</td>
                    <td className="px-4 py-2 font-medium text-ink-900">
                      {a.name}
                      {a.bankAccount && (
                        <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-normal text-emerald-700">
                          Deposit account
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-slate-500">{a.subtype ?? '—'}</td>
                    <td className="px-4 py-2 text-slate-500">{a.isActive ? 'Active' : 'Inactive'}</td>
                    {canEdit && (
                      <td className="px-4 py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {a.type === 'ASSET' && !a.bankAccount && (
                            <QuickAddButton
                              label="Enable for Deposits"
                              title={`Enable "${a.name}" for deposits`}
                              apiUrl={`/api/accounts/${a.id}/bank-account`}
                              buttonClassName="btn-secondary text-xs"
                              fields={[
                                {
                                  key: 'accountType',
                                  label: 'Account Type',
                                  type: 'select',
                                  options: [
                                    { value: 'CHECKING', label: 'Checking' },
                                    { value: 'SAVINGS', label: 'Savings' },
                                    { value: 'CREDIT_CARD', label: 'Credit Card' },
                                  ],
                                  defaultValue: 'CHECKING',
                                },
                                { key: 'accountNumberMasked', label: 'Account Number (optional)' },
                                {
                                  key: 'openingBalance',
                                  label: 'Opening Balance',
                                  type: 'number',
                                  step: '0.01',
                                  defaultValue: 0,
                                },
                                { key: 'currencyCode', label: 'Currency', defaultValue: currencyCode },
                              ]}
                            />
                          )}
                          {a.type === 'ASSET' && a.bankAccount && (
                            <RemoveDepositAccountButton accountId={a.id} accountName={a.name} />
                          )}
                          <QuickEditButton
                            title={`Edit ${a.name}`}
                            apiUrl={`/api/accounts/${a.id}`}
                            initialValues={{
                              code: a.code ?? '',
                              name: a.name,
                              subtype: a.subtype ?? '',
                              description: a.description ?? '',
                              isActive: a.isActive,
                            }}
                            fields={[
                              { key: 'code', label: 'Account Code' },
                              { key: 'name', label: 'Name', required: true },
                              { key: 'subtype', label: 'Subtype' },
                              { key: 'description', label: 'Description', type: 'textarea' },
                              { key: 'isActive', label: 'Active', type: 'checkbox' },
                            ]}
                          />
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {g.accounts.length === 0 && (
                  <tr>
                    <td colSpan={canEdit ? 5 : 4} className="px-4 py-6 text-center text-slate-400">
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
