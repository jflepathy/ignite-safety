import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { formatMoney } from '@/lib/money';
import QuickAddButton from '@/components/shared/quick-add-button';
import TaxRateActions from '@/components/tax/tax-rate-actions';
import VatCalendar from '@/components/tax/vat-calendar';
import { filingPeriods } from '@/lib/vat';

// Tax Center: tax rates, VAT collected, the VAT filing calendar and the log
// of returns prepared/filed/paid (Session 23). No e-filing: returns are
// prepared and printed here, then filed with the tax authority by the user.
export default async function TaxCenterPage() {
  const [taxRates, invoices, settings, session, returns] = await Promise.all([
    prisma.taxRate.findMany({ orderBy: { name: 'asc' } }),
    prisma.invoice.findMany({ where: { deletedAt: null, status: { notIn: ['DRAFT', 'VOID'] } }, select: { taxTotal: true, issueDate: true } }),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
    getServerSession(authOptions),
    prisma.vatReturn.findMany({ orderBy: { periodStart: 'desc' } }),
  ]);
  const currency = settings?.currencyCode ?? 'SCR';
  const isAdmin = session?.user.role === 'ADMIN';

  const now = new Date();
  const ytd = invoices.filter((i) => i.issueDate.getFullYear() === now.getFullYear());
  const vatCollectedYtd = ytd.reduce((s, i) => s + Number(i.taxTotal), 0);
  const vatCollectedAllTime = invoices.reduce((s, i) => s + Number(i.taxTotal), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">Tax Center</h1>
        <p className="text-sm text-slate-500">Tax rates, VAT collected, the filing calendar and your VAT returns.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="card p-4">
          <p className="text-xs uppercase text-slate-500">VAT Collected ({now.getFullYear()})</p>
          <p className="text-2xl font-semibold text-ink-900">{formatMoney(vatCollectedYtd, currency)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase text-slate-500">VAT Collected (All Time)</p>
          <p className="text-2xl font-semibold text-ink-900">{formatMoney(vatCollectedAllTime, currency)}</p>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-ink-900">Tax Rates</h2>
          {isAdmin && (
            <QuickAddButton
              label="+ New Tax Rate"
              title="New Tax Rate"
              apiUrl="/api/tax-rates"
              fields={[
                { key: 'name', label: 'Name', required: true },
                { key: 'ratePercent', label: 'Rate (%)', type: 'number', step: '0.01', required: true },
              ]}
            />
          )}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2 text-right">Rate</th>
              <th className="px-4 py-2">Default</th>
              <th className="px-4 py-2">Status</th>
              {isAdmin && <th className="px-4 py-2"></th>}
            </tr>
          </thead>
          <tbody>
            {taxRates.map((t) => (
              <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-4 py-2 font-medium text-ink-900">{t.name}</td>
                <td className="px-4 py-2 text-right">{Number(t.ratePercent).toFixed(2)}%</td>
                <td className="px-4 py-2 text-slate-500">{t.isDefault ? 'Yes' : ''}</td>
                <td className="px-4 py-2 text-slate-500">{t.active ? 'Active' : 'Inactive'}</td>
                {isAdmin && (
                  <td className="px-4 py-2">
                    <TaxRateActions rate={{ id: t.id, name: t.name, ratePercent: Number(t.ratePercent), isDefault: t.isDefault, active: t.active }} />
                  </td>
                )}
              </tr>
            ))}
            {taxRates.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 5 : 4} className="px-4 py-6 text-center text-slate-400">
                  No tax rates set up yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <VatCalendar
        isAdmin={isAdmin}
        currency={currency}
        frequency={settings?.vatFilingFrequency ?? 'MONTHLY'}
        dueDay={settings?.vatDueDay ?? 21}
        periods={filingPeriods(settings?.vatFilingFrequency ?? 'MONTHLY', settings?.vatDueDay ?? 21).map((p) => ({
          start: p.start.toISOString().slice(0, 10),
          end: p.end.toISOString().slice(0, 10),
          label: p.label,
          due: p.due.toISOString().slice(0, 10),
        }))}
        returns={returns.map((r) => ({
          id: r.id,
          start: r.periodStart.toISOString().slice(0, 10),
          end: r.periodEnd.toISOString().slice(0, 10),
          due: r.dueDate.toISOString().slice(0, 10),
          status: r.status,
          outputTax: Number(r.outputTax) + Number(r.outputAdjustment),
          inputTax: Number(r.inputTax) + Number(r.inputAdjustment),
          netPayable: Number(r.netPayable),
          filedAt: r.filedAt ? r.filedAt.toISOString().slice(0, 10) : null,
          paidAt: r.paidAt ? r.paidAt.toISOString().slice(0, 10) : null,
          paidAmount: r.paidAmount != null ? Number(r.paidAmount) : null,
        }))}
      />
    </div>
  );
}
