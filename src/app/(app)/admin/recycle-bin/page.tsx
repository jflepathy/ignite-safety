import { prisma } from '@/lib/prisma';
import { formatMoney } from '@/lib/money';
import { formatDateTime } from '@/lib/format-date';
import RestoreButton from '@/components/admin/restore-button';

// Session 22, round 10 — admin-only Recycle Bin (route-gated by
// middleware.ts's '/admin' rule, same as every other Settings page).
// Lists every soft-deleted row across the 6 models that carry a
// `deletedAt` column and lets an admin restore one at a time. Nothing here
// is ever hard-deleted — see each model's DELETE handler.
export default async function RecycleBinPage() {
  const [settings, customers, suppliers, equipment, estimates, invoices, workOrders] = await Promise.all([
    prisma.appSettings.findUnique({ where: { id: 1 } }),
    prisma.customer.findMany({ where: { deletedAt: { not: null } }, orderBy: { deletedAt: 'desc' } }),
    prisma.supplier.findMany({ where: { deletedAt: { not: null } }, orderBy: { deletedAt: 'desc' } }),
    prisma.equipment.findMany({
      where: { deletedAt: { not: null } },
      include: { customer: true },
      orderBy: { deletedAt: 'desc' },
    }),
    prisma.estimate.findMany({
      where: { deletedAt: { not: null } },
      include: { customer: true },
      orderBy: { deletedAt: 'desc' },
    }),
    prisma.invoice.findMany({
      where: { deletedAt: { not: null } },
      include: { customer: true },
      orderBy: { deletedAt: 'desc' },
    }),
    prisma.workOrder.findMany({
      where: { deletedAt: { not: null } },
      include: { customer: true },
      orderBy: { deletedAt: 'desc' },
    }),
  ]);
  const currency = settings?.currencyCode ?? 'SCR';

  const sections = [
    {
      key: 'customers',
      type: 'customer' as const,
      title: 'Customers',
      rows: customers.map((c) => ({
        id: c.id,
        deletedAt: c.deletedAt!,
        cells: [c.displayName, c.phone ?? '—', c.email ?? '—'],
      })),
    },
    {
      key: 'suppliers',
      type: 'supplier' as const,
      title: 'Suppliers',
      rows: suppliers.map((s) => ({
        id: s.id,
        deletedAt: s.deletedAt!,
        cells: [s.displayName, s.phone ?? '—', s.email ?? '—'],
      })),
    },
    {
      key: 'equipment',
      type: 'equipment' as const,
      title: 'Equipment',
      rows: equipment.map((e) => ({
        id: e.id,
        deletedAt: e.deletedAt!,
        cells: [e.category, e.serialNumber ?? '—', e.customer?.displayName ?? '—'],
      })),
    },
    {
      key: 'estimates',
      type: 'estimate' as const,
      title: 'Estimates',
      rows: estimates.map((e) => ({
        id: e.id,
        deletedAt: e.deletedAt!,
        cells: [e.estimateNumber, e.customer.displayName, formatMoney(e.total.toString(), currency)],
      })),
    },
    {
      key: 'invoices',
      type: 'invoice' as const,
      title: 'Invoices & Sales Receipts',
      rows: invoices.map((i) => ({
        id: i.id,
        deletedAt: i.deletedAt!,
        cells: [i.invoiceNumber, i.customer.displayName, formatMoney(i.total.toString(), currency)],
      })),
    },
    {
      key: 'workOrders',
      type: 'workOrder' as const,
      title: 'Work Orders',
      rows: workOrders.map((w) => ({
        id: w.id,
        deletedAt: w.deletedAt!,
        cells: [w.woNumber, w.customer.displayName, w.status],
      })),
    },
  ];

  const totalCount = sections.reduce((sum, s) => sum + s.rows.length, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">Recycle Bin</h1>
        <p className="text-sm text-slate-500">
          Deleted records land here instead of disappearing for good. Restore any of them, or leave them — nothing
          here is ever automatically purged.
        </p>
      </div>

      {totalCount === 0 && (
        <div className="card p-10 text-center text-slate-400">Nothing in the Recycle Bin right now.</div>
      )}

      {sections
        .filter((s) => s.rows.length > 0)
        .map((s) => (
          <div key={s.key} className="card overflow-x-auto">
            <div className="border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-ink-900">{s.title}</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
                  <th className="px-4 py-2">Name / Number</th>
                  <th className="px-4 py-2"></th>
                  <th className="px-4 py-2"></th>
                  <th className="px-4 py-2">Deleted</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {s.rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-2 font-medium text-ink-900">{r.cells[0]}</td>
                    <td className="px-4 py-2 text-slate-500">{r.cells[1]}</td>
                    <td className="px-4 py-2 text-slate-500">{r.cells[2]}</td>
                    <td className="px-4 py-2 text-slate-500">{formatDateTime(r.deletedAt)}</td>
                    <td className="px-4 py-2 text-right">
                      <RestoreButton type={s.type} id={r.id} label={String(r.cells[0])} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </div>
  );
}
