'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { StatusBadge } from '@/components/status-badge';
import { formatMoney } from '@/lib/money';

type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  customerName: string;
  issueDate: string;
  dueDate: string | null;
  total: string;
  balanceDue: string;
  status: string;
};

type EstimateRow = {
  id: string;
  estimateNumber: string;
  customerName: string;
  issueDate: string;
  total: string;
  status: string;
};

type CreditNoteRow = {
  id: string;
  creditNoteNumber: string;
  customerName: string;
  relatedInvoiceNumber: string | null;
  total: string;
  status: string;
};

/**
 * Renders the Invoices/Estimates/Credit Notes tab strip + tables entirely
 * client-side. All three datasets are fetched once, server-side, in
 * billing/page.tsx and handed down as plain (already-serialized) props —
 * switching tabs is a local state update with zero network round trip, so
 * it's instant instead of triggering a full page reload. The URL is still
 * kept in sync (via router.replace, fired after the local state update so
 * it never blocks the visible switch) purely so the sidebar highlight and
 * bookmarking/sharing keep working.
 */
export default function BillingTabsClient({
  currency,
  initialTab,
  invoices,
  estimates,
  creditNotes,
}: {
  currency: string;
  initialTab: string;
  invoices: InvoiceRow[];
  estimates: EstimateRow[];
  creditNotes: CreditNoteRow[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState(initialTab);

  function selectTab(key: string) {
    setTab(key);
    // Non-blocking: the table below already switched via local state above,
    // this just keeps the address bar / sidebar highlight in sync.
    router.replace(`/billing?tab=${key}`, { scroll: false });
  }

  const tabs = [
    { key: 'invoices', label: `Invoices (${invoices.length})` },
    { key: 'estimates', label: `Estimates (${estimates.length})` },
    { key: 'credit-notes', label: `Credit Notes (${creditNotes.length})` },
  ];

  return (
    <div className="card">
      <div className="flex gap-1 border-b border-slate-200 px-4 pt-3">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => selectTab(t.key)}
            className={`rounded-t-lg px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.key ? 'border-b-2 border-brand-600 text-brand-700' : 'text-slate-500 hover:text-ink-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'invoices' && (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Invoice #</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Issue Date</th>
              <th className="px-4 py-3">Due Date</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Balance</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/billing/invoices/${inv.id}`} className="font-medium text-brand-700 hover:underline">
                    {inv.invoiceNumber}
                  </Link>
                </td>
                <td className="px-4 py-3">{inv.customerName}</td>
                <td className="px-4 py-3 text-slate-500">{inv.issueDate}</td>
                <td className="px-4 py-3 text-slate-500">{inv.dueDate ?? '—'}</td>
                <td className="px-4 py-3 text-right">{formatMoney(inv.total, currency)}</td>
                <td className="px-4 py-3 text-right font-medium">{formatMoney(inv.balanceDue, currency)}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={inv.status} />
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  No invoices yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {tab === 'estimates' && (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Estimate #</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Issue Date</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {estimates.map((es) => (
              <tr key={es.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/billing/estimates/${es.id}`} className="font-medium text-brand-700 hover:underline">
                    {es.estimateNumber}
                  </Link>
                </td>
                <td className="px-4 py-3">{es.customerName}</td>
                <td className="px-4 py-3 text-slate-500">{es.issueDate}</td>
                <td className="px-4 py-3 text-right">{formatMoney(es.total, currency)}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={es.status} />
                </td>
              </tr>
            ))}
            {estimates.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                  No estimates yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {tab === 'credit-notes' && (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Credit Note #</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Related Invoice</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {creditNotes.map((cn) => (
              <tr key={cn.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-ink-900">{cn.creditNoteNumber}</td>
                <td className="px-4 py-3">{cn.customerName}</td>
                <td className="px-4 py-3 text-slate-500">{cn.relatedInvoiceNumber ?? '—'}</td>
                <td className="px-4 py-3 text-right">{formatMoney(cn.total, currency)}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={cn.status} />
                </td>
              </tr>
            ))}
            {creditNotes.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                  No credit notes yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
