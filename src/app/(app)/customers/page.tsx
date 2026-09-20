import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import NewCustomerButton from '@/components/customers/new-customer-button';

export default async function CustomersPage() {
  const customers = await prisma.customer.findMany({
    where: { deletedAt: null },
    include: { _count: { select: { equipment: true, invoices: true, workOrders: true } } },
    orderBy: { displayName: 'asc' },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Customers</h1>
          <p className="text-sm text-slate-500">Client directory, phone lookup, and equipment history.</p>
        </div>
        <NewCustomerButton />
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Region</th>
              <th className="px-4 py-3">District</th>
              <th className="px-4 py-3">Equipment</th>
              <th className="px-4 py-3">Work Orders</th>
              <th className="px-4 py-3">Invoices</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-ink-900">{c.displayName}</td>
                <td className="px-4 py-3 text-slate-500">{c.phone ?? '—'}</td>
                <td className="px-4 py-3 text-slate-500">{c.region ?? '—'}</td>
                <td className="px-4 py-3 text-slate-500">{c.district ?? '—'}</td>
                <td className="px-4 py-3">{c._count.equipment}</td>
                <td className="px-4 py-3">{c._count.workOrders}</td>
                <td className="px-4 py-3">{c._count.invoices}</td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  No customers yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
