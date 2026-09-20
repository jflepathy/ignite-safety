import { prisma } from '@/lib/prisma';
import UsersManager from '@/components/admin/users-manager';

export default async function UsersPage() {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, active: true },
    orderBy: { createdAt: 'asc' },
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">User Management</h1>
        <p className="text-sm text-slate-500">Role-based access control — Admin, Sales, Technician.</p>
      </div>
      <UsersManager users={users} />
    </div>
  );
}
