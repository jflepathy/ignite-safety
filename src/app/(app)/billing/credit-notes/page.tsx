import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { formatMoney } from '@/lib/money';
import { StatusBadge } from '@/components/status-badge';

export default async function CreditNotesPage() {
  const [notes, settings] = await Promise.all([
    prisma.creditNote.findMany({ include: { customer: true, invoice: true }, orderBy: { createdAt: 'desc' }, take: 200 }),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
  ]);
  const currency = settings?.currencyCode ?? 'SCR';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Credit Notes</h1>
          <p className="text-sm text-slate-500">Credits issued against a customer&apos;s account or a specific invoice.</p>
        </div>
        <Link href="/billing/credit-notes/new" className="btn-primary">
          + New Credit Note
        </Link>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Credit #</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Linked Invoice</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Issue Date</th>
              <th className="px-4 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {notes.map((n) => (
              <tr key={n.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-ink-900">{n.creditNoteNumber}</td>
                <td className="px-4 py-3 text-slate-500">{n.customer.displayName}</td>
                <td className="px-4 py-3 text-slate-500">{n.invoice?.invoiceNumber ?? '—'}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={n.status} />
                </td>
                <td className="px-4 py-3 text-slate-500">{n.createdAt.toLocaleDateString()}</td>
                <td className="px-4 py-3 text-right font-medium">{formatMoney(n.total.toString(), currency)}</td>
              </tr>
            ))}
            {notes.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  No credit notes yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
