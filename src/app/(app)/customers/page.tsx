import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { canEditModule } from '@/lib/edit-permissions-constants';
import NewCustomerButton from '@/components/customers/new-customer-button';
import QuickEditButton from '@/components/shared/quick-edit-button';

export default async function CustomersPage() {
  const [customers, session] = await Promise.all([
    prisma.customer.findMany({
      where: { deletedAt: null },
      include: { _count: { select: { equipment: true, invoices: true, workOrders: true } } },
      orderBy: { displayName: 'asc' },
    }),
    getServerSession(authOptions),
  ]);
  const isAdmin = session?.user.role === 'ADMIN';
  const canEdit = canEditModule('customers', isAdmin, session?.user.editModules);

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
              {canEdit && <th className="px-4 py-3"></th>}
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
                {canEdit && (
                  <td className="px-4 py-3 text-right">
                    <QuickEditButton
                      title={`Edit ${c.displayName}`}
                      apiUrl={`/api/customers/${c.id}`}
                      initialValues={{
                        displayName: c.displayName,
                        type: c.type,
                        contactPerson: c.contactPerson ?? '',
                        phone: c.phone ?? '',
                        altPhone: c.altPhone ?? '',
                        email: c.email ?? '',
                        address: c.address ?? '',
                        region: c.region ?? '',
                        district: c.district ?? '',
                        taxId: c.taxId ?? '',
                        notes: c.notes ?? '',
                      }}
                      fields={[
                        { key: 'displayName', label: 'Name', required: true },
                        {
                          key: 'type',
                          label: 'Type',
                          type: 'select',
                          options: [
                            { value: 'COMPANY', label: 'Company' },
                            { value: 'INDIVIDUAL', label: 'Individual' },
                            { value: 'GOVERNMENT', label: 'Government' },
                          ],
                        },
                        { key: 'contactPerson', label: 'Contact Person' },
                        { key: 'phone', label: 'Phone' },
                        { key: 'altPhone', label: 'Alt. Phone' },
                        { key: 'email', label: 'Email' },
                        { key: 'address', label: 'Address' },
                        { key: 'region', label: 'Region' },
                        { key: 'district', label: 'District' },
                        { key: 'taxId', label: 'Tax / VAT ID' },
                        { key: 'notes', label: 'Notes', type: 'textarea' },
                      ]}
                    />
                  </td>
                )}
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan={canEdit ? 8 : 7} className="px-4 py-10 text-center text-slate-400">
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
