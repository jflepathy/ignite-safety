import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { canEditModule } from '@/lib/edit-permissions-constants';
import Link from 'next/link';
import { formatMoney } from '@/lib/money';
import { StatusBadge } from '@/components/status-badge';
import PayBillButton from '@/components/expenses/pay-bill-button';
import QuickEditButton from '@/components/shared/quick-edit-button';

function toDateInput(d: Date | null) {
  return d ? d.toISOString().slice(0, 10) : '';
}

export default async function BillsPage() {
  const [bills, settings, session] = await Promise.all([
    prisma.bill.findMany({ include: { supplier: true }, orderBy: { billDate: 'desc' } }),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
    getServerSession(authOptions),
  ]);
  const currency = settings?.currencyCode ?? 'SCR';
  const totalOwed = bills.reduce((s, b) => s + Number(b.balanceDue), 0);
  const isAdmin = session?.user.role === 'ADMIN';
  const canEdit = canEditModule('bills', isAdmin, session?.user.editModules);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Bills</h1>
          <p className="text-sm text-slate-500">Money owed to suppliers, tracked to payment.</p>
        </div>
        <Link href="/expenses/bills/new" className="btn-primary">
          + New Bill
        </Link>
      </div>

      <div className="card p-4">
        <p className="text-xs uppercase text-slate-500">Total Outstanding</p>
        <p className="text-2xl font-semibold text-ink-900">{formatMoney(totalOwed, currency)}</p>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Bill #</th>
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3">Bill Date</th>
              <th className="px-4 py-3">Due Date</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Balance Due</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {bills.map((b) => (
              <tr key={b.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-ink-900">{b.billNumber}</td>
                <td className="px-4 py-3 text-slate-500">{b.supplier.displayName}</td>
                <td className="px-4 py-3 text-slate-500">{b.billDate.toLocaleDateString()}</td>
                <td className="px-4 py-3 text-slate-500">{b.dueDate ? b.dueDate.toLocaleDateString() : '—'}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={b.status} />
                </td>
                <td className="px-4 py-3 text-right">{formatMoney(b.total.toString(), currency)}</td>
                <td className="px-4 py-3 text-right font-medium">{formatMoney(b.balanceDue.toString(), currency)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-3">
                    {canEdit && (
                      <QuickEditButton
                        title={`Edit ${b.billNumber}`}
                        apiUrl={`/api/bills/${b.id}`}
                        initialValues={{
                          supplierRef: b.supplierRef ?? '',
                          dueDate: toDateInput(b.dueDate),
                          terms: b.terms ?? '',
                          notes: b.notes ?? '',
                          status: b.status,
                        }}
                        fields={[
                          { key: 'supplierRef', label: "Supplier's Ref #" },
                          { key: 'dueDate', label: 'Due Date', type: 'date' },
                          { key: 'terms', label: 'Terms' },
                          { key: 'notes', label: 'Notes', type: 'textarea' },
                          {
                            key: 'status',
                            label: 'Status',
                            type: 'select',
                            options: [
                              { value: 'OPEN', label: 'Open' },
                              { value: 'PARTIAL', label: 'Partial' },
                              { value: 'PAID', label: 'Paid' },
                              { value: 'OVERDUE', label: 'Overdue' },
                              { value: 'VOID', label: 'Void' },
                            ],
                          },
                        ]}
                      />
                    )}
                    {Number(b.balanceDue) > 0 && <PayBillButton billId={b.id} maxAmount={Number(b.balanceDue)} currency={currency} />}
                  </div>
                </td>
              </tr>
            ))}
            {bills.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                  No bills yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
