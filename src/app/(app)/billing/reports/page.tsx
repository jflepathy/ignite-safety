import { prisma } from '@/lib/prisma';
import { formatMoney } from '@/lib/money';
import { differenceInCalendarDays } from 'date-fns';

export default async function ReportsPage() {
  const [settings, invoices, payments, expenses] = await Promise.all([
    prisma.appSettings.findUnique({ where: { id: 1 } }),
    prisma.invoice.findMany({
      where: { deletedAt: null, status: { in: ['SENT', 'PARTIAL', 'OVERDUE'] }, balanceDue: { gt: 0 } },
      include: { customer: true },
    }),
    prisma.payment.findMany(),
    prisma.expense.findMany(),
  ]);

  const currency = settings?.currencyCode ?? 'SCR';
  const today = new Date();

  const buckets = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 };
  const rows = invoices.map((inv) => {
    const dueDate = inv.dueDate ?? inv.issueDate;
    const daysPastDue = differenceInCalendarDays(today, dueDate);
    const balance = Number(inv.balanceDue);
    if (daysPastDue <= 0) buckets.current += balance;
    else if (daysPastDue <= 30) buckets.d1_30 += balance;
    else if (daysPastDue <= 60) buckets.d31_60 += balance;
    else if (daysPastDue <= 90) buckets.d61_90 += balance;
    else buckets.d90_plus += balance;
    return { ...inv, daysPastDue, balance };
  });
  const grandTotal = Object.values(buckets).reduce((a, b) => a + b, 0);

  const income = payments.reduce((s, p) => s + Number(p.amount), 0);
  const expenseTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const invoicesAll = await prisma.invoice.findMany({
    where: { deletedAt: null, status: { not: 'VOID' } },
    select: { subtotal: true, taxTotal: true },
  });
  const totalTaxCollected = invoicesAll.reduce((s, i) => s + Number(i.taxTotal), 0);
  const totalTaxableSales = invoicesAll.reduce((s, i) => s + Number(i.subtotal), 0);

  const bucketLabels: [keyof typeof buckets, string][] = [
    ['current', 'Current'],
    ['d1_30', '1–30 days'],
    ['d31_60', '31–60 days'],
    ['d61_90', '61–90 days'],
    ['d90_plus', '90+ days'],
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">Financial Reports</h1>
        <p className="text-sm text-slate-500">Accounts receivable, income vs. expense, and sales tax collection.</p>
      </div>

      <section className="card p-6">
        <h2 className="mb-4 text-sm font-semibold text-ink-900">Accounts Receivable Aging</h2>
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {bucketLabels.map(([key, label]) => (
            <div key={key} className="rounded-lg bg-slate-50 p-3 text-center">
              <p className="text-xs text-slate-500">{label}</p>
              <p className="mt-1 text-lg font-semibold text-ink-900">{formatMoney(buckets[key], currency)}</p>
            </div>
          ))}
        </div>
        <p className="mb-3 text-sm text-slate-600">
          Total outstanding: <span className="font-semibold text-ink-900">{formatMoney(grandTotal, currency)}</span>
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
              <th className="py-2">Invoice</th>
              <th className="py-2">Customer</th>
              <th className="py-2 text-right">Days Past Due</th>
              <th className="py-2 text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {rows
              .sort((a, b) => b.daysPastDue - a.daysPastDue)
              .map((r) => (
                <tr key={r.id} className="border-b border-slate-50">
                  <td className="py-2">{r.invoiceNumber}</td>
                  <td className="py-2">{r.customer.displayName}</td>
                  <td className="py-2 text-right">{r.daysPastDue}</td>
                  <td className="py-2 text-right">{formatMoney(r.balance, currency)}</td>
                </tr>
              ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-slate-400">
                  Nothing outstanding.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="mb-4 text-sm font-semibold text-ink-900">Income vs. Expense Summary</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Total Income (payments received)</span>
              <span className="font-medium text-emerald-600">{formatMoney(income, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Total Expenses</span>
              <span className="font-medium text-red-600">{formatMoney(expenseTotal, currency)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold">
              <span>Net</span>
              <span className={income - expenseTotal >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                {formatMoney(income - expenseTotal, currency)}
              </span>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="mb-4 text-sm font-semibold text-ink-900">Sales Tax Collection Summary</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Total Taxable Sales</span>
              <span className="font-medium">{formatMoney(totalTaxableSales, currency)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold">
              <span>Total Tax Collected</span>
              <span>{formatMoney(totalTaxCollected, currency)}</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
