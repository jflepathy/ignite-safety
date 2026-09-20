import { prisma } from '@/lib/prisma';
import QuickAddButton from '@/components/shared/quick-add-button';
import LeadStatusSelect from '@/components/customer-hub/lead-status-select';

const STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'UNQUALIFIED', 'CONVERTED'];

export default async function LeadsPage() {
  const leads = await prisma.lead.findMany({ include: { opportunities: true }, orderBy: { createdAt: 'desc' } });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Leads</h1>
          <p className="text-sm text-slate-500">Prospects that haven&apos;t become a customer yet.</p>
        </div>
        <QuickAddButton
          label="+ New Lead"
          title="New Lead"
          apiUrl="/api/leads"
          fields={[
            { key: 'name', label: 'Name', required: true },
            { key: 'companyName', label: 'Company' },
            { key: 'phone', label: 'Phone' },
            { key: 'email', label: 'Email' },
            {
              key: 'source',
              label: 'Source',
              type: 'select',
              options: ['Referral', 'Website', 'Walk-in', 'Phone', 'Other'].map((s) => ({ value: s, label: s })),
              defaultValue: 'Referral',
            },
            { key: 'notes', label: 'Notes', type: 'textarea' },
          ]}
        />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Opportunities</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-ink-900">{l.name}</td>
                <td className="px-4 py-3 text-slate-500">{l.companyName ?? '—'}</td>
                <td className="px-4 py-3 text-slate-500">{l.phone ?? l.email ?? '—'}</td>
                <td className="px-4 py-3 text-slate-500">{l.source ?? '—'}</td>
                <td className="px-4 py-3">{l.opportunities.length}</td>
                <td className="px-4 py-3">
                  <LeadStatusSelect leadId={l.id} status={l.status} options={STATUSES} />
                </td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  No leads yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
