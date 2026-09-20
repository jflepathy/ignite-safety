import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { formatMoney } from '@/lib/money';

export default async function CustomerHubPage() {
  const [customerCount, leadCount, openOpportunities, settings] = await Promise.all([
    prisma.customer.count({ where: { deletedAt: null } }),
    prisma.lead.count({ where: { status: { in: ['NEW', 'CONTACTED', 'QUALIFIED'] } } }),
    prisma.opportunity.findMany({ where: { stage: { notIn: ['WON', 'LOST'] } } }),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
  ]);
  const currency = settings?.currencyCode ?? 'SCR';
  const pipelineValue = openOpportunities.reduce((s, o) => s + Number(o.estimatedValue), 0);

  const cards = [
    { label: 'Customers', value: customerCount.toString(), href: '/customers' },
    { label: 'Active Leads', value: leadCount.toString(), href: '/customer-hub/leads' },
    { label: 'Open Opportunities', value: openOpportunities.length.toString(), href: '/customer-hub/opportunities' },
    { label: 'Open Pipeline Value', value: formatMoney(pipelineValue, currency), href: '/customer-hub/opportunities' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">Customer Hub</h1>
        <p className="text-sm text-slate-500">Customers, leads and the sales pipeline in one place.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="card block p-4 transition hover:border-brand-300">
            <p className="text-xs uppercase text-slate-500">{c.label}</p>
            <p className="mt-1 text-2xl font-semibold text-ink-900">{c.value}</p>
          </Link>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link href="/customers" className="card p-4 hover:border-brand-300">
          <p className="font-medium text-ink-900">Customers & Sites</p>
          <p className="text-sm text-slate-500">Directory, contacts, equipment history.</p>
        </Link>
        <Link href="/customer-hub/leads" className="card p-4 hover:border-brand-300">
          <p className="font-medium text-ink-900">Leads</p>
          <p className="text-sm text-slate-500">Prospects not yet converted to customers.</p>
        </Link>
        <Link href="/customer-hub/opportunities" className="card p-4 hover:border-brand-300">
          <p className="font-medium text-ink-900">Opportunities</p>
          <p className="text-sm text-slate-500">Deals in progress, by stage.</p>
        </Link>
      </div>
    </div>
  );
}
