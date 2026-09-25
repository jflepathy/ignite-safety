import { getServerSession } from 'next-auth';
import Link from 'next/link';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatMoney } from '@/lib/money';
import { computeIncentiveForServiceLines, type ServiceLine } from '@/lib/incentives';
import { formatDate } from '@/lib/format-date';

function monthBounds(monthStr: string) {
  // monthStr: "YYYY-MM"
  const [y, m] = monthStr.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { start, end };
}

function monthLabel(monthStr: string) {
  const { start } = monthBounds(monthStr);
  return start.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function shiftMonth(monthStr: string, delta: number) {
  const [y, m] = monthStr.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export default async function TechnicianIncentivePage({ searchParams }: { searchParams: { month?: string } }) {
  const session = await getServerSession(authOptions);
  const now = new Date();
  const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const month = searchParams?.month && /^\d{4}-\d{2}$/.test(searchParams.month) ? searchParams.month : currentMonth;
  const { start, end } = monthBounds(month);

  const [settings, shopItems, incentiveRates, workOrders] = await Promise.all([
    prisma.appSettings.findUnique({ where: { id: 1 } }),
    prisma.shopItem.findMany(),
    prisma.incentiveRate.findMany(),
    prisma.workOrder.findMany({
      where: {
        // A job counts toward this technician's incentive whether they're
        // the primary or one of the admin-added additional technicians on
        // it (Session 20) -- the earned amount is split equally across
        // everyone on the job below.
        OR: [
          { assignedTechnicianId: session!.user.id },
          { additionalTechnicians: { some: { technicianId: session!.user.id } } },
        ],
        deletedAt: null,
        invoiceId: { not: null },
        invoice: { issueDate: { gte: start, lt: end } },
      },
      include: { invoice: true, additionalTechnicians: true },
      orderBy: { completedAt: 'desc' },
    }),
  ]);

  const currency = settings?.currencyCode ?? 'SCR';
  const defaultFraction = settings?.defaultIncentiveFraction ? Number(settings.defaultIncentiveFraction) : 0.2;
  const shopItemsById = new Map(shopItems.map((s) => [s.id, { id: s.id, sku: s.sku, name: s.name, unitPrice: Number(s.unitPrice), taxable: s.taxable }]));
  const ratesByKey = new Map(
    incentiveRates.map((r) => [
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

  let totalServiced = 0;
  let totalIncentive = 0;
  const perService = new Map<string, { label: string; quantity: number; incentiveAmount: number }>();
  const jobRows: { woNumber: string; invoiceNumber: string; date: Date; serviced: number; incentive: number; splitWith?: number }[] = [];

  for (const wo of workOrders) {
    const lines = (wo.serviceLines as unknown as ServiceLine[]) ?? [];
    const results = computeIncentiveForServiceLines(lines, ratesByKey, shopItemsById, defaultFraction);
    // Split equally across everyone on the job: the primary technician
    // plus however many additional technicians the admin put on it
    // (Session 20). A job with just the primary (the normal case) divides
    // by 1, i.e. no change from before this feature existed.
    const headcount = 1 + wo.additionalTechnicians.length;
    let jobServiced = 0;
    let jobIncentive = 0;
    for (const r of results) {
      const share = r.incentiveAmount / headcount;
      totalServiced += r.quantity;
      totalIncentive += share;
      jobServiced += r.quantity;
      jobIncentive += share;
      const existing = perService.get(r.key);
      if (existing) {
        existing.quantity += r.quantity;
        existing.incentiveAmount += share;
      } else {
        perService.set(r.key, { label: r.label, quantity: r.quantity, incentiveAmount: share });
      }
    }
    jobRows.push({
      woNumber: wo.woNumber,
      invoiceNumber: wo.invoice?.invoiceNumber ?? '—',
      date: wo.invoice?.issueDate ?? wo.completedAt ?? wo.updatedAt,
      serviced: jobServiced,
      incentive: jobIncentive,
      splitWith: headcount > 1 ? headcount : undefined,
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link
          href={`/technician/incentive?month=${shiftMonth(month, -1)}`}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600"
        >
          ← Prev
        </Link>
        <h1 className="text-base font-semibold text-ink-900">{monthLabel(month)}</h1>
        {month === currentMonth ? (
          <span className="px-3 py-1.5 text-sm text-slate-300">Next →</span>
        ) : (
          <Link
            href={`/technician/incentive?month=${shiftMonth(month, 1)}`}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600"
          >
            Next →
          </Link>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 text-center shadow-sm">
        <p className="text-xs uppercase tracking-wide text-slate-400">Incentive Earned</p>
        <p className="mt-1 text-3xl font-bold text-brand-600">{formatMoney(totalIncentive, currency)}</p>
        <p className="mt-2 text-sm text-slate-500">{totalServiced} equipment/service{totalServiced === 1 ? '' : 's'} completed</p>
      </div>

      {perService.size > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-ink-900">By Service</h2>
          <div className="space-y-2">
            {[...perService.entries()].map(([key, v]) => (
              <div key={key} className="flex items-center justify-between text-sm">
                <span className="text-slate-600">
                  {v.label} <span className="text-xs text-slate-400">× {v.quantity}</span>
                </span>
                <span className="font-medium text-ink-900">{formatMoney(v.incentiveAmount, currency)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-ink-900">Jobs Invoiced This Month</h2>
        {jobRows.length === 0 && <p className="text-sm text-slate-400">No jobs invoiced yet this month.</p>}
        <div className="space-y-2">
          {jobRows.map((j, idx) => (
            <div key={idx} className="flex items-center justify-between border-t border-slate-50 pt-2 text-sm first:border-0 first:pt-0">
              <div>
                <p className="font-medium text-ink-900">{j.woNumber}</p>
                <p className="text-xs text-slate-400">
                  Invoice {j.invoiceNumber} · {formatDate(j.date)}
                  {j.splitWith && ` · split ${j.splitWith} ways`}
                </p>
              </div>
              <span className="font-medium text-ink-900">{formatMoney(j.incentive, currency)}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-center text-xs text-slate-400">
        Earned once the job's invoice is raised (draft or sent) — doesn't require the client to have paid yet.
      </p>
    </div>
  );
}
