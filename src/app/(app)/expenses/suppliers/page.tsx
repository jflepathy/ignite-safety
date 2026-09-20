import { prisma } from '@/lib/prisma';
import QuickAddButton from '@/components/shared/quick-add-button';

export default async function SuppliersPage() {
  const suppliers = await prisma.supplier.findMany({
    where: { deletedAt: null },
    include: { _count: { select: { bills: true, purchaseOrders: true } } },
    orderBy: { displayName: 'asc' },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Suppliers</h1>
          <p className="text-sm text-slate-500">Vendors you buy equipment, parts and services from.</p>
        </div>
        <QuickAddButton
          label="+ New Supplier"
          title="New Supplier"
          apiUrl="/api/suppliers"
          fields={[
            { key: 'displayName', label: 'Display Name', required: true },
            { key: 'companyName', label: 'Company Name' },
            { key: 'contactPerson', label: 'Contact Person' },
            { key: 'phone', label: 'Phone' },
            { key: 'email', label: 'Email' },
            { key: 'address', label: 'Address', type: 'textarea' },
            { key: 'taxId', label: 'Tax / VAT ID' },
          ]}
        />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Bills</th>
              <th className="px-4 py-3">POs</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s) => (
              <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-ink-900">{s.displayName}</td>
                <td className="px-4 py-3 text-slate-500">{s.contactPerson ?? '—'}</td>
                <td className="px-4 py-3 text-slate-500">{s.phone ?? '—'}</td>
                <td className="px-4 py-3 text-slate-500">{s.email ?? '—'}</td>
                <td className="px-4 py-3">{s._count.bills}</td>
                <td className="px-4 py-3">{s._count.purchaseOrders}</td>
              </tr>
            ))}
            {suppliers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  No suppliers yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
