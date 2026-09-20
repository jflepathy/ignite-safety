import { prisma } from '@/lib/prisma';
import TimeActivityForm from '@/components/team/time-activity-form';

export default async function NewTimeActivityPage() {
  const [employees, customers] = await Promise.all([
    prisma.employee.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.customer.findMany({ where: { deletedAt: null }, orderBy: { displayName: 'asc' } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">Single Time Activity</h1>
        <p className="text-sm text-slate-500">Log hours worked by one employee.</p>
      </div>
      <TimeActivityForm
        employees={employees.map((e) => ({ id: e.id, name: e.name }))}
        customers={customers.map((c) => ({ id: c.id, name: c.displayName }))}
      />
    </div>
  );
}
