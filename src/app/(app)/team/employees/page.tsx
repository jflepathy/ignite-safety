import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import QuickAddButton from '@/components/shared/quick-add-button';
import QuickEditButton from '@/components/shared/quick-edit-button';
import { formatMoney } from '@/lib/money';
import { formatDate } from '@/lib/format-date';

function toDateInput(d: Date | null) {
  return d ? d.toISOString().slice(0, 10) : '';
}

const EMPLOYMENT_TYPES = ['Permanent', 'Contract', 'Part-Time', 'Probation'];

export default async function EmployeesPage({ searchParams }: { searchParams: { showInactive?: string } }) {
  const showInactive = searchParams?.showInactive === '1';
  const [allEmployees, settings, session] = await Promise.all([
    prisma.employee.findMany({ orderBy: { name: 'asc' } }),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
    getServerSession(authOptions),
  ]);
  const inactiveCount = allEmployees.filter((e) => !e.active).length;
  const employees = showInactive ? allEmployees : allEmployees.filter((e) => e.active);
  const currency = settings?.currencyCode ?? 'SCR';
  const isAdmin = session?.user.role === 'ADMIN';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Employees</h1>
          <p className="text-sm text-slate-500">Team roster used for time tracking and job assignment.</p>
        </div>
        <div className="flex items-center gap-4">
          {inactiveCount > 0 && (
            <a href={showInactive ? '/team/employees' : '/team/employees?showInactive=1'} className="text-xs font-medium text-brand-600 hover:underline">
              {showInactive ? 'Hide inactive' : `Show inactive (${inactiveCount})`}
            </a>
          )}
          {isAdmin && (
          <QuickAddButton
            label="+ New Employee"
            title="New Employee"
            apiUrl="/api/employees"
            fields={[
              { key: 'name', label: 'Name', required: true },
              { key: 'nin', label: 'NIN (National ID Number)' },
              { key: 'homeAddress', label: 'Home Address', type: 'textarea' },
              { key: 'email', label: 'Email' },
              { key: 'phone', label: 'Phone' },
              { key: 'jobTitle', label: 'Job Title' },
              { key: 'department', label: 'Department' },
              { key: 'hireDate', label: 'Hire Date', type: 'date' },
              {
                key: 'employmentType',
                label: 'Employment Type',
                type: 'select',
                options: ['Permanent', 'Contract', 'Part-Time', 'Probation'].map((t) => ({ value: t, label: t })),
                defaultValue: 'Permanent',
              },
              { key: 'contractEndDate', label: 'Contract End Date (if fixed-term)', type: 'date' },
              { key: 'standardHoursPerWeek', label: 'Standard Hours / Week', type: 'number', defaultValue: 40 },
              {
                key: 'payType',
                label: 'Pay Type',
                type: 'select',
                options: [
                  { value: 'MONTHLY', label: 'Monthly' },
                  { value: 'HOURLY', label: 'Hourly' },
                  { value: 'SALARY', label: 'Salary (annual)' },
                ],
                defaultValue: 'MONTHLY',
              },
              { key: 'payRate', label: `Pay Rate (${currency}) — monthly amount for Monthly pay type`, type: 'number', step: '0.01' },
            ]}
          />
          )}
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Job Title</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Employment</th>
              <th className="px-4 py-3 text-right">Hours/Wk</th>
              <th className="px-4 py-3">Pay Type</th>
              <th className="px-4 py-3 text-right">Pay Rate</th>
              <th className="px-4 py-3">Status</th>
              {isAdmin && <th className="px-4 py-3"></th>}
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-ink-900">{e.name}</td>
                <td className="px-4 py-3 text-slate-500">{e.jobTitle ?? '—'}</td>
                <td className="px-4 py-3 text-slate-500">{e.department ?? '—'}</td>
                <td className="px-4 py-3 text-slate-500">{e.phone ?? e.email ?? '—'}</td>
                <td className="px-4 py-3 text-slate-500">
                  {e.employmentType ?? '—'}
                  {e.contractEndDate && <span className="block text-xs text-slate-400">until {formatDate(e.contractEndDate)}</span>}
                </td>
                <td className="px-4 py-3 text-right text-slate-500">{e.standardHoursPerWeek?.toString() ?? '—'}</td>
                <td className="px-4 py-3 text-slate-500">{e.payType}</td>
                <td className="px-4 py-3 text-right">
                  {e.payRate ? formatMoney(e.payRate.toString(), currency) : '—'}
                  {e.payType === 'MONTHLY' && e.payRate && <span className="block text-xs text-slate-400">/month</span>}
                </td>
                <td className="px-4 py-3 text-slate-500">{e.active ? 'Active' : 'Inactive'}</td>
                {isAdmin && (
                  <td className="px-4 py-3 text-right">
                    <QuickEditButton
                      title={`Edit ${e.name}`}
                      apiUrl={`/api/employees/${e.id}`}
                      initialValues={{
                        name: e.name,
                        nin: e.nin ?? '',
                        homeAddress: e.homeAddress ?? '',
                        email: e.email ?? '',
                        phone: e.phone ?? '',
                        jobTitle: e.jobTitle ?? '',
                        department: e.department ?? '',
                        hireDate: toDateInput(e.hireDate),
                        employmentType: e.employmentType ?? 'Permanent',
                        contractEndDate: toDateInput(e.contractEndDate),
                        standardHoursPerWeek: e.standardHoursPerWeek ? Number(e.standardHoursPerWeek) : 40,
                        payType: e.payType,
                        payRate: e.payRate ? Number(e.payRate) : 0,
                        active: e.active,
                      }}
                      fields={[
                        { key: 'name', label: 'Name', required: true },
                        { key: 'nin', label: 'NIN (National ID Number)' },
                        { key: 'homeAddress', label: 'Home Address', type: 'textarea' },
                        { key: 'email', label: 'Email' },
                        { key: 'phone', label: 'Phone' },
                        { key: 'jobTitle', label: 'Job Title' },
                        { key: 'department', label: 'Department' },
                        { key: 'hireDate', label: 'Hire Date', type: 'date' },
                        {
                          key: 'employmentType',
                          label: 'Employment Type',
                          type: 'select',
                          options: EMPLOYMENT_TYPES.map((t) => ({ value: t, label: t })),
                        },
                        { key: 'contractEndDate', label: 'Contract End Date (if fixed-term)', type: 'date' },
                        { key: 'standardHoursPerWeek', label: 'Standard Hours / Week', type: 'number' },
                        {
                          key: 'payType',
                          label: 'Pay Type',
                          type: 'select',
                          options: [
                            { value: 'MONTHLY', label: 'Monthly' },
                            { value: 'HOURLY', label: 'Hourly' },
                            { value: 'SALARY', label: 'Salary (annual)' },
                          ],
                        },
                        { key: 'payRate', label: `Pay Rate (${currency})`, type: 'number', step: '0.01' },
                        { key: 'active', label: 'Active', type: 'checkbox' },
                      ]}
                    />
                  </td>
                )}
              </tr>
            ))}
            {employees.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 10 : 9} className="px-4 py-10 text-center text-slate-400">
                  No employees yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
