import { prisma } from '@/lib/prisma';
import { formatMoney } from '@/lib/money';
import QuickAddButton from '@/components/shared/quick-add-button';
import OpportunityStageSelect from '@/components/customer-hub/opportunity-stage-select';
import { formatDate } from '@/lib/format-date';

const STAGES = ['PROSPECTING', 'QUALIFICATION', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'];

export default async function OpportunitiesPage() {
  const [opportunities, customers, leads, settings] = await Promise.all([
    prisma.opportunity.findMany({ include: { customer: true, lead: true }, orderBy: { createdAt: 'desc' } }),
    prisma.customer.findMany({ where: { deletedAt: null }, orderBy: { displayName: 'asc' } }),
    prisma.lead.findMany({ orderBy: { name: 'asc' } }),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
  ]);
  const currency = settings?.currencyCode ?? 'SCR';
  const openTotal = opportunities.filter((o) => !['WON', 'LOST'].includes(o.stage)).reduce((s, o) => s + Number(o.estimatedValue), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Opportunities</h1>
          <p className="text-sm text-slate-500">Deals in progress, tracked by stage.</p>
        </div>
        <QuickAddButton
          label="+ New Opportunity"
          title="New Opportunity"
          apiUrl="/api/opportunities"
          fields={[
            { key: 'name', label: 'Opportunity Name', required: true },
            {
              key: 'customerId',
              label: 'Customer (if existing)',
              type: 'select',
              options: [{ value: '', label: '—' }, ...customers.map((c) => ({ value: c.id, label: c.displayName }))],
            },
            {
              key: 'leadId',
              label: 'Lead (if not yet a customer)',
              type: 'select',
              options: [{ value: '', label: '—' }, ...leads.map((l) => ({ value: l.id, label: l.name }))],
            },
            { key: 'estimatedValue', label: `Estimated Value (${currency})`, type: 'number', step: '0.01' },
            { key: 'probabilityPercent', label: 'Probability (%)', type: 'number', defaultValue: 50 },
            { key: 'expectedCloseDate', label: 'Expected Close Date', type: 'date' },
            { key: 'notes', label: 'Notes', type: 'textarea' },
          ]}
        />
      </div>

      <div className="card p-4">
        <p className="text-xs uppercase text-slate-500">Open Pipeline Value</p>
        <p className="text-2xl font-semibold text-ink-900">{formatMoney(openTotal, currency)}</p>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Customer / Lead</th>
              <th className="px-4 py-3 text-right">Est. Value</th>
              <th className="px-4 py-3 text-right">Probability</th>
              <th className="px-4 py-3">Close Date</th>
              <th className="px-4 py-3">Stage</th>
            </tr>
          </thead>
          <tbody>
            {opportunities.map((o) => (
              <tr key={o.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-ink-900">{o.name}</td>
                <td className="px-4 py-3 text-slate-500">{o.customer?.displayName ?? o.lead?.name ?? '—'}</td>
                <td className="px-4 py-3 text-right">{formatMoney(o.estimatedValue.toString(), currency)}</td>
                <td className="px-4 py-3 text-right">{o.probabilityPercent}%</td>
                <td className="px-4 py-3 text-slate-500">{o.expectedCloseDate ? formatDate(o.expectedCloseDate) : '—'}</td>
                <td className="px-4 py-3">
                  <OpportunityStageSelect opportunityId={o.id} stage={o.stage} options={STAGES} />
                </td>
              </tr>
            ))}
            {opportunities.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  No opportunities yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
