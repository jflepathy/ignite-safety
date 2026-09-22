import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { canEditModule } from '@/lib/edit-permissions-constants';
import NewCustomerButton from '@/components/customers/new-customer-button';
import CustomersTable from '@/components/customers/customers-table';

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
      <CustomersTable customers={customers} canEdit={canEdit} />
    </div>
  );
}
