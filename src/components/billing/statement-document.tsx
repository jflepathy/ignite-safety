import { formatMoney } from '@/lib/money';
import type { StatementData } from '@/lib/statement';

/** Printable customer statement, in the same plain look as the invoice. */
export default function StatementDocument({ data }: { data: StatementData }) {
  const { settings, currency } = data;
  const m = (n: number) => formatMoney(n, currency);
  return (
    <div className="bg-white text-ink-900" style={{ fontFamily: '"Courier New", Courier, monospace' }}>
      <div className="flex items-start justify-between gap-6 border-b border-slate-100 bg-white p-8">
        <div>
          <p className="text-lg font-bold tracking-tight">{settings.companyName}</p>
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-500">{settings.companyAddress}</p>
          <p className="text-sm text-slate-500">{settings.companyPhone}</p>
          <p className="text-sm text-slate-500">{settings.companyEmail}</p>
        </div>
        {settings.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={settings.logoUrl} alt={settings.companyName} className="h-24 object-contain" />
        ) : (
          <div className="flex items-center gap-2 text-2xl font-bold tracking-wide">
            <span className="text-brand-600">{settings.companyName.split(' ')[0]?.toUpperCase()}</span>
            <span className="h-8 w-px bg-slate-300" />
            <span className="text-ink-900">{settings.companyName.split(' ').slice(1).join(' ').toUpperCase()}</span>
          </div>
        )}
      </div>

      <div className="p-8">
        <div className="mb-6 flex items-start justify-between border-b-2 border-ink-900 pb-4">
          <p className="text-3xl font-bold uppercase tracking-wide">Statement</p>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Statement Date</p>
            <p className="text-lg font-bold text-brand-600">{data.statementDate}</p>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-6 text-sm">
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Statement To</p>
            <p className="font-semibold">{data.customer.displayName}</p>
            <p className="whitespace-pre-line text-slate-500">{data.customer.address}</p>
            <p className="text-slate-500">{data.customer.phone}</p>
          </div>
          <div className="justify-self-end text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Period</p>
            <p className="font-medium">
              {data.fromDate ? `${data.fromDate} – ${data.toDate}` : `To ${data.toDate}`}
            </p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Amount Due</p>
            <p className="text-xl font-bold">{m(data.closingBalance)}</p>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-ink-900 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-2">Date</th>
              <th className="py-2 pr-2">Ref</th>
              <th className="py-2 pr-2">Description</th>
              <th className="py-2 pr-2 text-right">Charges</th>
              <th className="py-2 pr-2 text-right">Payments</th>
              <th className="py-2 text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {data.fromDate && (
              <tr className="border-b border-slate-100">
                <td className="py-1.5 pr-2">{data.fromDate}</td>
                <td className="py-1.5 pr-2"></td>
                <td className="py-1.5 pr-2 italic text-slate-500">Balance brought forward</td>
                <td className="py-1.5 pr-2"></td>
                <td className="py-1.5 pr-2"></td>
                <td className="py-1.5 text-right">{m(data.openingBalance)}</td>
              </tr>
            )}
            {data.lines.map((l, i) => (
              <tr key={i} className="border-b border-slate-100">
                <td className="py-1.5 pr-2 whitespace-nowrap">{l.date}</td>
                <td className="py-1.5 pr-2 whitespace-nowrap">{l.ref}</td>
                <td className="py-1.5 pr-2">{l.description}</td>
                <td className="py-1.5 pr-2 text-right">{l.charge ? m(l.charge) : ''}</td>
                <td className="py-1.5 pr-2 text-right">{l.credit ? m(l.credit) : ''}</td>
                <td className="py-1.5 text-right">{m(l.balance)}</td>
              </tr>
            ))}
            {data.lines.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-slate-400">
                  No activity in this period.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-ink-900 font-bold">
              <td colSpan={3} className="py-2">Total</td>
              <td className="py-2 pr-2 text-right">{m(data.totalCharges)}</td>
              <td className="py-2 pr-2 text-right">{m(data.totalCredits)}</td>
              <td className="py-2 text-right">{m(data.closingBalance)}</td>
            </tr>
          </tfoot>
        </table>

        {data.openInvoices.length > 0 && (
          <div className="mt-8 text-sm">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Open invoices (today)</p>
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-300 text-left text-xs uppercase text-slate-500">
                  <th className="py-1 pr-2">Invoice</th>
                  <th className="py-1 pr-2">Date</th>
                  <th className="py-1 pr-2">Due</th>
                  <th className="py-1 pr-2 text-right">Total</th>
                  <th className="py-1 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {data.openInvoices.map((o) => (
                  <tr key={o.number} className="border-b border-slate-100">
                    <td className="py-1 pr-2">{o.number}</td>
                    <td className="py-1 pr-2">{o.issueDate}</td>
                    <td className="py-1 pr-2">{o.dueDate ?? ''}</td>
                    <td className="py-1 pr-2 text-right">{m(o.total)}</td>
                    <td className="py-1 text-right">{m(o.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 grid grid-cols-5 gap-2 border border-slate-300 text-center text-xs">
              {(
                [
                  ['Current', data.aging.current],
                  ['1-30 days', data.aging.d1_30],
                  ['31-60 days', data.aging.d31_60],
                  ['61-90 days', data.aging.d61_90],
                  ['90+ days', data.aging.d90plus],
                ] as const
              ).map(([label, v]) => (
                <div key={label} className="p-2">
                  <p className="uppercase text-slate-400">{label}</p>
                  <p className="mt-1 text-sm font-semibold">{m(v)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {(settings.paymentInstructions || settings.bankName) && (
          <div className="mt-8 border-t border-dashed border-slate-300 pt-4 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Payment Methods</p>
            {settings.paymentInstructions && <p className="whitespace-pre-line text-slate-600">{settings.paymentInstructions}</p>}
            {settings.bankName && (
              <p className="text-slate-600">
                {settings.bankName}
                {settings.bankAccountName ? ` - ${settings.bankAccountName}` : ''}
                {settings.bankAccountNumber ? ` - ${settings.bankAccountNumber}` : ''}
              </p>
            )}
          </div>
        )}
        {settings.taxRegistrationNumber && <p className="mt-2 text-xs text-slate-500">TIN: {settings.taxRegistrationNumber}</p>}
      </div>
    </div>
  );
}
