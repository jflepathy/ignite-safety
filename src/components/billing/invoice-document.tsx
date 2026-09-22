import { formatMoney } from '@/lib/money';

type LineItem = {
  id: string;
  sku: string | null;
  description: string;
  quantity: string;
  unitPrice: string;
  discountPercent: string;
  taxName: string | null;
  lineTotal: string;
};

type Settings = {
  companyName: string;
  companyAddress: string | null;
  companyPhone: string | null;
  companyEmail: string | null;
  taxRegistrationNumber: string | null;
  logoUrl: string | null;
  paymentInstructions: string | null;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
};

/**
 * The canonical printable invoice layout, aligned to the company's
 * designated print/PDF template: company header + wordmark, BILL TO /
 * document-meta two-column block, ACTIVITY/DESCRIPTION/QTY/RATE/AMOUNT
 * line-item table, a dashed rule, a bold BALANCE DUE, a Payment Methods +
 * TIN footer block, and a closing "Thanking you for your business!" line.
 *
 * Used by both the authenticated invoice detail page and the public
 * unauthenticated share-link page so the two never drift apart. Wrap this
 * component in an element with class="print-area" to get clean, chrome-free
 * printing (see globals.css).
 */
export default function InvoiceDocument({
  settings,
  documentLabel = 'INVOICE',
  documentNumber,
  issueDate,
  dueDate,
  poNumber,
  terms,
  customer,
  lineItems,
  currency,
  subtotal,
  discountTotal,
  globalDiscountPercent,
  taxTotal,
  total,
  amountPaid,
  balanceDue,
  taxInclusive,
  customerMessage,
}: {
  settings: Settings;
  documentLabel?: string;
  documentNumber: string;
  issueDate: string;
  dueDate?: string | null;
  poNumber?: string | null;
  terms?: string | null;
  customer: { displayName: string; address: string | null; phone: string | null };
  lineItems: LineItem[];
  currency: string;
  subtotal: string;
  discountTotal: string;
  globalDiscountPercent: string;
  taxTotal: string;
  total: string;
  amountPaid?: string;
  balanceDue: string;
  taxInclusive?: boolean;
  customerMessage?: string | null;
}) {
  const hasDiscount = Number(globalDiscountPercent) > 0 || lineItems.some((li) => Number(li.discountPercent) > 0);
  const hasPaid = amountPaid !== undefined && Number(amountPaid) > 0;

  return (
    <div
      className="overflow-hidden rounded-xl border border-slate-200 bg-white text-ink-900 print:rounded-none print:border-0"
      style={{ fontFamily: '"Courier New", Courier, monospace' }}
    >
      {/* Company header band */}
      <div className="flex items-start justify-between gap-6 border-b border-slate-100 bg-slate-50/60 p-8 print:bg-white">
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
          <p className="text-3xl font-bold uppercase tracking-wide">{documentLabel}</p>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{documentLabel} No.</p>
            <p className="text-lg font-bold text-brand-600">{documentNumber}</p>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="rounded-lg bg-slate-50 p-4 text-sm print:bg-white print:p-0">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Bill To</p>
            <p className="font-semibold text-ink-900">{customer.displayName}</p>
            <p className="whitespace-pre-line text-slate-500">{customer.address}</p>
            <p className="text-slate-500">{customer.phone}</p>
          </div>
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 self-start text-sm sm:justify-self-end">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Date</span>
            <span className="text-right font-medium sm:text-left">{issueDate}</span>
            {terms && (
              <>
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Terms</span>
                <span className="text-right font-medium sm:text-left">{terms}</span>
              </>
            )}
            {dueDate && (
              <>
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Due Date</span>
                <span className="text-right font-medium sm:text-left">{dueDate}</span>
              </>
            )}
            {poNumber && (
              <>
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">PO Number</span>
                <span className="text-right font-medium sm:text-left">{poNumber}</span>
              </>
            )}
          </div>
        </div>

        {customerMessage && (
          <p className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 print:hidden">
            {customerMessage}
          </p>
        )}

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-slate-800 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-2">Activity</th>
              <th className="py-2 pr-2">Description</th>
              <th className="py-2 pr-2 text-right">Qty</th>
              <th className="py-2 pr-2 text-right">Rate</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((li, idx) => (
              <tr key={li.id} className={idx % 2 === 1 ? 'bg-slate-50/70 print:bg-white' : undefined}>
                <td className="py-2.5 pl-0 pr-2 align-top font-mono text-xs text-slate-500">{li.sku ?? '—'}</td>
                <td className="py-2.5 pr-2 align-top">
                  {li.description}
                  {(Number(li.discountPercent) > 0 || li.taxName) && (
                    <span className="ml-1 text-xs text-slate-400 print:hidden">
                      {Number(li.discountPercent) > 0 && `(${li.discountPercent}% disc.) `}
                      {li.taxName && `[${li.taxName}]`}
                    </span>
                  )}
                </td>
                <td className="py-2.5 pr-2 text-right align-top">{li.quantity}</td>
                <td className="py-2.5 pr-2 text-right align-top">{formatMoney(li.unitPrice, currency)}</td>
                <td className="py-2.5 pr-0 text-right align-top font-medium">{formatMoney(li.lineTotal, currency)}</td>
              </tr>
            ))}
          </tbody>
          <tbody>
            <tr>
              <td colSpan={5} className="border-t-2 border-slate-800 p-0" />
            </tr>
          </tbody>
        </table>

        <div className="mt-6 flex flex-col-reverse gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-xs text-xs leading-relaxed text-slate-500">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600">Payment Methods</p>
            <p className="whitespace-pre-line">{settings.paymentInstructions}</p>
            {settings.taxRegistrationNumber && <p className="mt-2 font-medium text-slate-600">TIN: {settings.taxRegistrationNumber}</p>}
            {settings.bankName && (
              <div className="mt-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Bank Details</p>
                <p className="whitespace-pre-line">
                  {settings.bankName}
                  {settings.bankAccountName && `\n${settings.bankAccountName}`}
                  {settings.bankAccountNumber && `\nAcc No.: ${settings.bankAccountNumber}`}
                </p>
              </div>
            )}
          </div>

          <div className="w-full space-y-1 text-sm sm:w-72">
            {(hasDiscount || Number(taxTotal) > 0 || hasPaid) && (
              <div className="space-y-1 print:hidden">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span>{formatMoney(subtotal, currency)}</span>
                </div>
                {hasDiscount && (
                  <div className="flex justify-between text-slate-600">
                    <span>Discount{Number(globalDiscountPercent) > 0 ? ` (${globalDiscountPercent}%)` : ''}</span>
                    <span>-{formatMoney(discountTotal, currency)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600">
                  <span>Tax</span>
                  <span>{formatMoney(taxTotal, currency)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold text-ink-900">
                  <span>Total</span>
                  <span>{formatMoney(total, currency)}</span>
                </div>
                {hasPaid && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Paid</span>
                    <span>-{formatMoney(amountPaid!, currency)}</span>
                  </div>
                )}
              </div>
            )}
            <div className="flex items-center justify-between rounded-lg bg-ink-900 px-4 py-3 text-white print:rounded-none print:bg-transparent print:px-0 print:text-ink-900">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-300 print:text-slate-500">Balance Due</span>
              <span className="text-xl font-bold">{formatMoney(balanceDue, currency)}</span>
            </div>
          </div>
        </div>

        {taxTotal !== undefined && (
          <p className="mt-2 text-right text-xs text-slate-400 print:hidden">
            Prices shown {taxInclusive ? 'include' : 'exclude'} tax.
          </p>
        )}

        <p className="mt-10 border-t border-dashed border-slate-200 pt-6 text-center text-xs text-slate-400">
          Thanking you for your business!
        </p>
      </div>
    </div>
  );
}
