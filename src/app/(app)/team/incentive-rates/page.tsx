import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { formatMoney } from '@/lib/money';
import { computeIncentiveForServiceLines, type ServiceLine } from '@/lib/incentives';
import { monthBounds, monthLabel, shiftMonth, currentMonthStr, isValidMonthStr } from '@/lib/month-range';
import { formatDate } from '@/lib/format-date';
import QuickAddButton from '@/components/shared/quick-add-button';
import QuickEditButton from '@/components/shared/quick-edit-button';

export default async function IncentiveRatesPage({ searchParams }: { searchParams: { month?: string } }) {
  const currentMonth = currentMonthStr();
  const month = isValidMonthStr(searchParams?.month) ? searchParams.month : currentMonth;
  const { start, end } = monthBounds(month);

  const [rates, shopItems, allShopItems, settings, bankAccounts, technicians, historyWorkOrders] = await Promise.all([
    prisma.incentiveRate.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { shopItem: true, bundledShopItem: true },
    }),
    prisma.shopItem.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    // Unfiltered (unlike `shopItems` above) -- a past month's incentive
    // history needs to price a job even if the catalog item it used has
    // since been deactivated, so the dropdown-only `active: true` filter
    // above doesn't apply here (Session 21).
    prisma.shopItem.findMany(),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
    prisma.bankAccount.findMany({ orderBy: { name: 'asc' } }),
    // Every active technician, even one with zero jobs this month -- admin
    // needs the full staff list for payroll, not just whoever earned
    // something (Session 21).
    prisma.user.findMany({ where: { role: 'TECHNICIAN', active: true }, orderBy: { name: 'asc' } }),
    prisma.workOrder.findMany({
      where: {
        deletedAt: null,
        invoiceId: { not: null },
        invoice: { issueDate: { gte: start, lt: end } },
      },
      include: { invoice: true, assignedTechnician: true, additionalTechnicians: { include: { technician: true } } },
      orderBy: { completedAt: 'desc' },
    }),
  ]);

  const currency = settings?.currencyCode ?? 'SCR';
  const defaultFraction = settings?.defaultIncentiveFraction ? Number(settings.defaultIncentiveFraction) : 0.2;

  // Staff Incentive History (Session 21) -- the same per-line/per-job math
  // as the technician's own Incentive tab (src/lib/incentives.ts,
  // computeIncentiveForServiceLines), but aggregated across every
  // technician for a selected month, and split equally across everyone on
  // a job (primary + additional technicians, Session 20) the same way the
  // technician-facing tab does -- so what admin uses to pay technicians
  // always matches what each technician sees on their own screen.
  const shopItemsByIdForHistory = new Map(allShopItems.map((s) => [s.id, { id: s.id, sku: s.sku, name: s.name, unitPrice: Number(s.unitPrice), taxable: s.taxable }]));
  const ratesByKeyForHistory = new Map(
    rates.map((r) => [
      r.key,
      {
        key: r.key,
        label: r.label,
        shopItemId: r.shopItemId,
        fractionOverride: r.fractionOverride != null ? Number(r.fractionOverride) : null,
        flatAmount: r.flatAmount != null ? Number(r.flatAmount) : null,
        bundledShopItemId: r.bundledShopItemId,
        bundledQuantityPerUnit: Number(r.bundledQuantityPerUnit),
        active: r.active,
      },
    ])
  );

  type HistoryJobRow = { woNumber: string; invoiceNumber: string; date: Date; serviced: number; share: number; headcount: number };
  type HistoryTechRow = { id: string; name: string; totalServiced: number; totalIncentive: number; jobs: HistoryJobRow[] };
  const historyByTechnician = new Map<string, HistoryTechRow>(
    technicians.map((t) => [t.id, { id: t.id, name: t.name, totalServiced: 0, totalIncentive: 0, jobs: [] }])
  );
  function ensureTechRow(id: string, name: string): HistoryTechRow {
    let row = historyByTechnician.get(id);
    if (!row) {
      row = { id, name, totalServiced: 0, totalIncentive: 0, jobs: [] };
      historyByTechnician.set(id, row);
    }
    return row;
  }

  for (const wo of historyWorkOrders) {
    const onJob = [
      wo.assignedTechnicianId ? { id: wo.assignedTechnicianId, name: wo.assignedTechnician?.name ?? 'Unknown' } : null,
      ...wo.additionalTechnicians.map((t) => ({ id: t.technicianId, name: t.technician.name })),
    ].filter((x): x is { id: string; name: string } => !!x);
    if (onJob.length === 0) continue;

    const lines = (wo.serviceLines as unknown as ServiceLine[]) ?? [];
    const results = computeIncentiveForServiceLines(lines, ratesByKeyForHistory, shopItemsByIdForHistory, defaultFraction);
    const jobServiced = results.reduce((s, r) => s + r.quantity, 0);
    const jobIncentive = results.reduce((s, r) => s + r.incentiveAmount, 0);
    const headcount = onJob.length;
    const share = jobIncentive / headcount;

    for (const tech of onJob) {
      const row = ensureTechRow(tech.id, tech.name);
      row.totalServiced += jobServiced;
      row.totalIncentive += share;
      row.jobs.push({
        woNumber: wo.woNumber,
        invoiceNumber: wo.invoice?.invoiceNumber ?? '—',
        date: wo.invoice?.issueDate ?? wo.completedAt ?? wo.updatedAt,
        serviced: jobServiced,
        share,
        headcount,
      });
    }
  }

  // Best performers first; technicians with nothing this month sort last.
  const historyRows = [...historyByTechnician.values()].sort((a, b) => b.totalIncentive - a.totalIncentive);
  const historyTotal = historyRows.reduce((s, r) => s + r.totalIncentive, 0);

  const shopItemOptions = [
    { value: '', label: '— Not mapped to a catalog item —' },
    ...shopItems.map((s) => ({ value: s.id, label: `${s.sku} — ${s.name} (${formatMoney(s.unitPrice.toString(), currency)})` })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Incentive Rates</h1>
          <p className="text-sm text-slate-500">
            What each service is billed at and how much of that a technician earns. Drives the technician Incentive
            tab and the auto-populated draft invoice when a completed Work Order is converted.
          </p>
        </div>
      </div>

      <div className="card space-y-3 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-ink-900">Program defaults</h2>
            <p className="mt-1 text-sm text-slate-500">
              Default share: <span className="font-medium text-ink-900">{(defaultFraction * 100).toFixed(1)}%</span> of a
              service's price, applied to any rate below that doesn't set its own override.
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Technician cash/cheque/transfer collections deposit into:{' '}
              <span className="font-medium text-ink-900">
                {bankAccounts.find((b) => b.id === settings?.technicianCollectionsBankAccountId)?.name ?? 'Not set — technician payment collection is blocked until this is configured'}
              </span>
            </p>
          </div>
          <QuickEditButton
            title="Edit Program Defaults"
            apiUrl="/api/settings"
            label="Edit Defaults"
            buttonClassName="btn-secondary text-sm"
            initialValues={{
              defaultIncentiveFraction: defaultFraction,
              technicianCollectionsBankAccountId: settings?.technicianCollectionsBankAccountId ?? '',
            }}
            fields={[
              { key: 'defaultIncentiveFraction', label: 'Default incentive fraction (e.g. 0.2 = 1/5)', type: 'number', step: '0.01' },
              {
                key: 'technicianCollectionsBankAccountId',
                label: 'Technician collections bank account',
                type: 'select',
                options: [{ value: '', label: '— None selected —' }, ...bankAccounts.map((b) => ({ value: b.id, label: b.name }))],
              },
            ]}
          />
        </div>
      </div>

      <div className="card space-y-3 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-ink-900">Staff Incentive History</h2>
            <p className="mt-1 text-sm text-slate-500">
              Every technician's incentive earned this month — for paying them and tracking performance over time.
              Matches each technician's own Incentive tab exactly, split equally when more than one technician is on
              a job.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/team/incentive-rates?month=${shiftMonth(month, -1)}`}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600"
            >
              ← Prev
            </Link>
            <span className="min-w-[9rem] text-center text-sm font-medium text-ink-900">{monthLabel(month)}</span>
            {month === currentMonth ? (
              <span className="px-3 py-1.5 text-sm text-slate-300">Next →</span>
            ) : (
              <Link
                href={`/team/incentive-rates?month=${shiftMonth(month, 1)}`}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600"
              >
                Next →
              </Link>
            )}
          </div>
        </div>

        {historyRows.length === 0 ? (
          <p className="text-sm text-slate-400">No active technicians on file yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
                  <th className="py-2">Technician</th>
                  <th className="py-2 text-right">Jobs</th>
                  <th className="py-2 text-right">Equipment/Services</th>
                  <th className="py-2 text-right">Incentive Earned</th>
                </tr>
              </thead>
              <tbody>
                {historyRows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-50 align-top">
                    <td className="py-2 pr-2 font-medium text-ink-900">
                      {row.jobs.length > 0 ? (
                        <details>
                          <summary className="cursor-pointer select-none hover:text-brand-600">{row.name}</summary>
                          <div className="mt-2 space-y-1 pl-3 text-xs text-slate-500">
                            {row.jobs.map((j, idx) => (
                              <div key={idx} className="flex items-center justify-between gap-4 border-t border-slate-50 pt-1 first:border-0 first:pt-0">
                                <span>
                                  {j.woNumber} · Invoice {j.invoiceNumber} · {formatDate(j.date)}
                                  {j.headcount > 1 && ` · split ${j.headcount} ways`}
                                </span>
                                <span className="shrink-0 font-medium text-ink-900">{formatMoney(j.share, currency)}</span>
                              </div>
                            ))}
                          </div>
                        </details>
                      ) : (
                        row.name
                      )}
                    </td>
                    <td className="py-2 text-right text-slate-500">{row.jobs.length}</td>
                    <td className="py-2 text-right text-slate-500">{row.totalServiced}</td>
                    <td className="py-2 text-right font-semibold text-ink-900">{formatMoney(row.totalIncentive, currency)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200">
                  <td className="py-2 font-semibold text-ink-900" colSpan={3}>
                    Total
                  </td>
                  <td className="py-2 text-right font-semibold text-ink-900">{formatMoney(historyTotal, currency)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Service</th>
              <th className="px-4 py-3">Catalog Item</th>
              <th className="px-4 py-3 text-right">Price</th>
              <th className="px-4 py-3">Incentive</th>
              <th className="px-4 py-3">Bundled Add-on</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rates.map((r) => {
              const effectiveFraction = r.fractionOverride != null ? Number(r.fractionOverride) : defaultFraction;
              return (
                <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-ink-900">
                    {r.label}
                    <span className="block text-xs text-slate-400">key: {r.key}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {r.shopItem ? `${r.shopItem.sku} — ${r.shopItem.name}` : <span className="text-amber-600">Unmapped — needs a catalog item</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-500">{r.shopItem ? formatMoney(r.shopItem.unitPrice.toString(), currency) : '—'}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {r.flatAmount != null
                      ? `${formatMoney(r.flatAmount.toString(), currency)} flat / unit`
                      : `${(effectiveFraction * 100).toFixed(1)}%${r.fractionOverride == null ? ' (default)' : ''}`}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {r.bundledShopItem ? `${r.bundledQuantityPerUnit}× ${r.bundledShopItem.name}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{r.active ? 'Active' : 'Inactive'}</td>
                  <td className="px-4 py-3 text-right">
                    <QuickEditButton
                      title={`Edit ${r.label}`}
                      apiUrl={`/api/incentive-rates/${r.id}`}
                      initialValues={{
                        label: r.label,
                        shopItemId: r.shopItemId ?? '',
                        fractionOverride: r.fractionOverride != null ? Number(r.fractionOverride) : '',
                        flatAmount: r.flatAmount != null ? Number(r.flatAmount) : '',
                        bundledShopItemId: r.bundledShopItemId ?? '',
                        bundledQuantityPerUnit: Number(r.bundledQuantityPerUnit),
                        active: r.active,
                      }}
                      fields={[
                        { key: 'label', label: 'Label', required: true },
                        { key: 'shopItemId', label: 'Catalog item (price billed to customer)', type: 'select', options: shopItemOptions },
                        { key: 'fractionOverride', label: 'Incentive fraction override (blank = use default)', type: 'number', step: '0.01' },
                        { key: 'flatAmount', label: `Flat incentive per unit (${currency}) — overrides fraction entirely`, type: 'number', step: '0.01' },
                        { key: 'bundledShopItemId', label: 'Auto-bundle this catalog item', type: 'select', options: shopItemOptions },
                        { key: 'bundledQuantityPerUnit', label: 'Bundled quantity per unit serviced', type: 'number', step: '1' },
                        { key: 'active', label: 'Active', type: 'checkbox' },
                      ]}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="card space-y-3 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-ink-900">New catalog item</h2>
            <p className="mt-1 text-sm text-slate-500">
              For a service not priced yet (e.g. Suppression, Valve Change) or a technician's custom line that keeps
              coming up — add it to the catalog here, then edit the matching row above to link it.
            </p>
          </div>
          <QuickAddButton
            label="+ New Catalog Item"
            title="New Catalog Item"
            apiUrl="/api/shop-items"
            fields={[
              { key: 'sku', label: 'SKU', required: true },
              { key: 'name', label: 'Name', required: true },
              { key: 'unitPrice', label: `Price (${currency})`, type: 'number', step: '0.01', required: true },
              { key: 'itemType', label: 'Type', type: 'select', options: [{ value: 'SERVICE', label: 'Service' }, { value: 'NON_INVENTORY', label: 'Non-Inventory' }], defaultValue: 'SERVICE' },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
