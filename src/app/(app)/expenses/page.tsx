import { prisma } from '@/lib/prisma';
import { formatMoney } from '@/lib/money';
import QuickAddButton from '@/components/shared/quick-add-button';

const METHODS = ['CASH', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'OTHER'];

export default async function ExpensesPage() {
  const [expenses, settings, accounts, suppliers] = await Promise.all([
    prisma.expense.findMany({ orderBy: { date: 'desc' }, take: 200, include: { account: true, supplier: true } }),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
    prisma.account.findMany({ where: { type: 'EXPENSE', isActive: true }, orderBy: { name: 'asc' } }),
    prisma.supplier.findMany({ where: { deletedAt: null, active: true }, orderBy: { displayName: 'asc' } }),
  ]);
  const currency = settings?.currencyCode ?? 'SCR';
  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Expense Transactions</h1>
          <p className="text-sm text-slate-500">One-off, already-paid business expenses (fuel, supplies, rent, etc.)</p>
        </div>
        <QuickAddButton
          label="+ New Expense"
          title="New Expense"
          apiUrl="/api/expenses"
          fields={[
            {
              key: 'accountId',
              label: 'Chart of Accounts Category',
              required: true,
              type: 'select',
              options: accounts.map((a) => ({ value: a.id, label: a.code ? `${a.code} — ${a.name}` : a.name })),
            },
            {
              key: 'supplierId',
              label: 'Supplier (optional)',
              type: 'select',
              options: [{ value: '', label: '— No supplier —' }, ...suppliers.map((s) => ({ value: s.id, label: s.displayName }))],
            },
            { key: 'vendor', label: 'Vendor name (if no supplier record)' },
            { key: 'description', label: 'Description' },
            { key: 'amount', label: `Amount (${currency})`, type: 'number', step: '0.01', required: true },
            {
              key: 'method',
              label: 'Payment Method',
              type: 'select',
              options: METHODS.map((m) => ({ value: m, label: m.replace('_', ' ') })),
              defaultValue: 'BANK_TRANSFER',
            },
            { key: 'date', label: 'Date', type: 'date' },
            { key: 'reference', label: 'Reference #' },
          ]}
        />
      </div>

      <div className="card p-4">
        <p className="text-xs uppercase text-slate-500">Total (last 200)</p>
        <p className="text-2xl font-semibold text-ink-900">{formatMoney(total, currency)}</p>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Account</th>
              <th className="px-4 py-3">Supplier / Vendor</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-500">{e.date.toLocaleDateString()}</td>
                <td className="px-4 py-3 font-medium text-ink-900">{e.account?.name ?? e.category}</td>
                <td className="px-4 py-3 text-slate-500">{e.supplier?.displayName ?? e.vendor ?? '—'}</td>
                <td className="px-4 py-3 text-slate-500">{e.description ?? '—'}</td>
                <td className="px-4 py-3 text-slate-500">{e.method.replace('_', ' ')}</td>
                <td className="px-4 py-3 text-right font-medium">{formatMoney(e.amount.toString(), currency)}</td>
              </tr>
            ))}
            {expenses.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  No expenses recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
