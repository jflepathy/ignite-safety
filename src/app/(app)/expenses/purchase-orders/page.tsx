import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { canEditModule } from '@/lib/edit-permissions-constants';
import Link from 'next/link';
import { formatMoney } from '@/lib/money';
import { formatDate } from '@/lib/format-date';
import { StatusBadge } from '@/components/status-badge';
import QuickEditButton from '@/components/shared/quick-edit-button';

function toDateInput(d: Date | null) {
  return d ? d.toISOString().slice(0, 10) : '';
}

export default async function PurchaseOrdersPage() {
  const [orders, settings, session] = await Promise.all([
    prisma.purchaseOrder.findMany({ include: { supplier: true }, orderBy: { orderDate: 'desc' } }),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
    getServerSession(authOptions),
  ]);
  const currency = settings?.currencyCode ?? 'SCR';
  const isAdmin = session?.user.role === 'ADMIN';
  const canEdit = canEditModule('purchaseOrders', isAdmin, session?.user.editModules);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Purchase Orders</h1>
          <p className="text-sm text-slate-500">Orders placed with suppliers, prior to receiving stock or a bill.</p>
        </div>
        <Link href="/expenses/purchase-orders/new" className="btn-primary">
          + New Purchase Order
        </Link>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">PO #</th>
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3">Order Date</th>
              <th className="px-4 py-3">Expected</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Total</th>
              {canEdit && <th className="px-4 py-3"></th>}
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-ink-900">{o.poNumber}</td>
                <td className="px-4 py-3 text-slate-500">{o.supplier.displayName}</td>
                <td className="px-4 py-3 text-slate-500">{formatDate(o.orderDate)}</td>
                <td className="px-4 py-3 text-slate-500">{o.expectedDate ? formatDate(o.expectedDate) : '—'}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={o.status} />
                </td>
                <td className="px-4 py-3 text-right font-medium">{formatMoney(o.total.toString(), currency)}</td>
                {canEdit && (
                  <td className="px-4 py-3 text-right">
                    <QuickEditButton
                      title={`Edit ${o.poNumber}`}
                      apiUrl={`/api/purchase-orders/${o.id}`}
                      initialValues={{
                        expectedDate: toDateInput(o.expectedDate),
                        notes: o.notes ?? '',
                        status: o.status,
                      }}
                      fields={[
                        { key: 'expectedDate', label: 'Expected Date', type: 'date' },
                        { key: 'notes', label: 'Notes', type: 'textarea' },
                        {
                          key: 'status',
                          label: 'Status',
                          type: 'select',
                          options: [
                            { value: 'DRAFT', label: 'Draft' },
                            { value: 'OPEN', label: 'Open' },
                            { value: 'PARTIALLY_RECEIVED', label: 'Partially Received' },
                            { value: 'RECEIVED', label: 'Received' },
                            { value: 'CLOSED', label: 'Closed' },
                            { value: 'CANCELLED', label: 'Cancelled' },
                          ],
                        },
                      ]}
                    />
                  </td>
                )}
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={canEdit ? 7 : 6} className="px-4 py-10 text-center text-slate-400">
                  No purchase orders yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
