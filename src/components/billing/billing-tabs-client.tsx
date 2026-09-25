'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { StatusBadge } from '@/components/status-badge';
import { formatMoney } from '@/lib/money';

export type DocRow = {
  id: string;
  docType: 'invoice' | 'salesReceipt' | 'estimate' | 'creditNote';
  number: string;
  href: string | null;
  customerName: string;
  date: string;
  dateSort: string;
  total: string;
  balanceDue: string | null;
  status: string;
};

const TYPE_LABEL: Record<DocRow['docType'], string> = {
  invoice: 'Invoice',
  salesReceipt: 'Sales Receipt',
  estimate: 'Estimate',
  creditNote: 'Credit Note',
};

const TYPE_BADGE_CLASS: Record<DocRow['docType'], string> = {
  invoice: 'bg-blue-50 text-blue-700',
  salesReceipt: 'bg-emerald-50 text-emerald-700',
  estimate: 'bg-amber-50 text-amber-700',
  creditNote: 'bg-slate-100 text-slate-600',
};

/**
 * One unified row table drives every tab on Billing > Overview — "All" is
 * the whole `docs` array (already sorted newest-first server-side, across
 * Invoice/Sales Receipt/Estimate/Credit Note), and the other three tabs
 * are just client-side `docType` filters of the same array. Invoice and
 * Sales Receipt share one docType group ("Invoice & Sales Receipts")
 * since they're drawn from the same numbering sequence — see billing/
 * page.tsx. Switching tabs and typing in the search box are both local
 * state, zero network round trips; the URL's `?tab=` is kept in sync
 * (via router.replace, non-blocking) purely for the sidebar highlight and
 * bookmarking/sharing.
 *
 * The reverse direction also has to work: clicking a sidebar link (e.g.
 * "Overview" -> `/billing`, "Estimates" -> `/billing?tab=estimates`) is a
 * real navigation, which re-runs the server-component page with the new
 * `tab` search param and passes a new `initialTab` prop down here — but
 * React does NOT re-initialize `useState(initialTab)` from a changed prop
 * on an already-mounted component (only the first render uses that
 * value), so without an explicit sync the tab strip and table just sat on
 * whatever tab was active before the click, no matter which sidebar link
 * was clicked. Fixed with the effect below, which re-applies `initialTab`
 * whenever it actually changes.
 */
export default function BillingTabsClient({
  currency,
  initialTab,
  docs,
}: {
  currency: string;
  initialTab: string;
  docs: DocRow[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState(initialTab);
  const [query, setQuery] = useState('');

  useEffect(() => {
    setTab(initialTab);
    setQuery('');
  }, [initialTab]);

  function selectTab(key: string) {
    setTab(key);
    setQuery('');
    // Non-blocking: the table below already switched via local state above,
    // this just keeps the address bar / sidebar highlight in sync.
    router.replace(`/billing?tab=${key}`, { scroll: false });
  }

  const byType = useMemo(() => {
    const groups: Record<string, DocRow[]> = {
      all: docs,
      estimates: docs.filter((d) => d.docType === 'estimate'),
      documents: docs.filter((d) => d.docType === 'invoice' || d.docType === 'salesReceipt'),
      'credit-notes': docs.filter((d) => d.docType === 'creditNote'),
    };
    return groups;
  }, [docs]);

  const tabs = [
    { key: 'all', label: `All (${byType.all.length})` },
    { key: 'estimates', label: `Estimates (${byType.estimates.length})` },
    { key: 'documents', label: `Invoice & Sales Receipts (${byType.documents.length})` },
    { key: 'credit-notes', label: `Credit Notes (${byType['credit-notes'].length})` },
  ];

  const activeRows = byType[tab] ?? byType.all;
  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return activeRows;
    return activeRows.filter(
      (d) => d.number.toLowerCase().includes(q) || d.customerName.toLowerCase().includes(q)
    );
  }, [activeRows, query]);

  const showTypeColumn = tab === 'all' || tab === 'documents';

  // The "+ New ..." actions are scoped to whichever tab is actually showing
  // (client-side `tab` state, not the server's `initialTab` prop, so the
  // buttons update instantly on an in-page tab click, not just after a
  // sidebar navigation) — Estimates only offers a new Estimate, Invoice &
  // Sales Receipts offers both of *its* document types, Credit Notes offers
  // a new Credit Note, and All/Overview offers every type since it isn't
  // scoped to one.
  const NEW_ESTIMATE = { href: '/billing/estimates/new', label: '+ New Estimate' };
  const NEW_INVOICE = { href: '/billing/invoices/new', label: '+ New Invoice' };
  const NEW_SALES_RECEIPT = { href: '/billing/sales-receipts/new', label: '+ New Sales Receipt' };
  const NEW_CREDIT_NOTE = { href: '/billing/credit-notes/new', label: '+ New Credit Note' };
  const newDocActions: { href: string; label: string }[] =
    tab === 'estimates'
      ? [NEW_ESTIMATE]
      : tab === 'documents'
        ? [NEW_INVOICE, NEW_SALES_RECEIPT]
        : tab === 'credit-notes'
          ? [NEW_CREDIT_NOTE]
          : [NEW_ESTIMATE, NEW_INVOICE, NEW_SALES_RECEIPT, NEW_CREDIT_NOTE];

  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 pt-3">
        <div className="flex flex-wrap gap-1">
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
        <div className="flex flex-wrap items-center gap-2 pb-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by number or customer…"
            className="input w-56"
          />
          <div className="flex flex-wrap gap-2">
            {newDocActions.map((a, i) => (
              <Link key={a.href} href={a.href} className={i === newDocActions.length - 1 ? 'btn-primary' : 'btn-secondary'}>
                {a.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
            {showTypeColumn && <th className="px-4 py-3">Type</th>}
            <th className="px-4 py-3">Number</th>
            <th className="px-4 py-3">Customer</th>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3 text-right">Total</th>
            <th className="px-4 py-3 text-right">Balance</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {filteredRows.map((d) => (
            <tr key={`${d.docType}-${d.id}`} className="border-b border-slate-50 hover:bg-slate-50">
              {showTypeColumn && (
                <td className="px-4 py-3">
                  <span className={`badge ${TYPE_BADGE_CLASS[d.docType]}`}>{TYPE_LABEL[d.docType]}</span>
                </td>
              )}
              <td className="px-4 py-3">
                {d.href ? (
                  <Link href={d.href} className="font-medium text-brand-700 hover:underline">
                    {d.number}
                  </Link>
                ) : (
                  <span className="font-medium text-ink-900">{d.number}</span>
                )}
              </td>
              <td className="px-4 py-3">{d.customerName}</td>
              <td className="px-4 py-3 text-slate-500">{d.date}</td>
              <td className="px-4 py-3 text-right">{formatMoney(d.total, currency)}</td>
              <td className="px-4 py-3 text-right font-medium">
                {d.balanceDue !== null ? formatMoney(d.balanceDue, currency) : '—'}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={d.status} />
              </td>
            </tr>
          ))}
          {filteredRows.length === 0 && (
            <tr>
              <td colSpan={showTypeColumn ? 7 : 6} className="px-4 py-10 text-center text-slate-400">
                {query ? 'No matches.' : 'Nothing here yet.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
