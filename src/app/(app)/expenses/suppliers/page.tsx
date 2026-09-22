import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { canEditModule } from '@/lib/edit-permissions-constants';
import QuickAddButton from '@/components/shared/quick-add-button';
import QuickEditButton from '@/components/shared/quick-edit-button';

export default async function SuppliersPage() {
  const [suppliers, session] = await Promise.all([
    prisma.supplier.findMany({
      where: { deletedAt: null },
      include: { _count: { select: { bills: true, purchaseOrders: true } } },
      orderBy: { displayName: 'asc' },
    }),
    getServerSession(authOptions),
  ]);
  const isAdmin = session?.user.role === 'ADMIN';
  const canEdit = canEditModule('suppliers', isAdmin, session?.user.editModules);

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
              {canEdit && <th className="px-4 py-3"></th>}
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
                {canEdit && (
                  <td className="px-4 py-3 text-right">
                    <QuickEditButton
                      title={`Edit ${s.displayName}`}
                      apiUrl={`/api/suppliers/${s.id}`}
                      initialValues={{
                        displayName: s.displayName,
                        companyName: s.companyName ?? '',
                        contactPerson: s.contactPerson ?? '',
                        phone: s.phone ?? '',
                        email: s.email ?? '',
                        address: s.address ?? '',
                        taxId: s.taxId ?? '',
                        notes: s.notes ?? '',
                      }}
                      fields={[
                        { key: 'displayName', label: 'Display Name', required: true },
                        { key: 'companyName', label: 'Company Name' },
                        { key: 'contactPerson', label: 'Contact Person' },
                        { key: 'phone', label: 'Phone' },
                        { key: 'email', label: 'Email' },
                        { key: 'address', label: 'Address', type: 'textarea' },
                        { key: 'taxId', label: 'Tax / VAT ID' },
                        { key: 'notes', label: 'Notes', type: 'textarea' },
                      ]}
                    />
                  </td>
                )}
              </tr>
            ))}
            {suppliers.length === 0 && (
              <tr>
                <td colSpan={canEdit ? 7 : 6} className="px-4 py-10 text-center text-slate-400">
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
