import { getServerSession } from 'next-auth';
import Link from 'next/link';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatMoney } from '@/lib/money';

// "Today's Invoices" (Session 19) -- every invoice this technician has
// personally raised today, in one place, so they can re-forward (WhatsApp/
// email) or fix a line item while still on site, without having to
// remember which job it came from. Scoped by createdById (who actually
// raised it), not by job assignment, since that's what "raised by me"
// means. Edit only shows up on the invoice's own page while it's still
// DRAFT -- the moment sales/admin confirms it (Sent/Partial/Paid), this
// list still shows it (so the technician can see it moved along and
// re-share it) but the Edit link disappears there.
function dayBounds(d: Date) {
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  SENT: 'bg-blue-100 text-blue-700',
  PARTIAL: 'bg-amber-100 text-amber-700',
  PAID: 'bg-emerald-100 text-emerald-700',
  OVERDUE: 'bg-red-100 text-red-700',
  VOID: 'bg-slate-100 text-slate-400',
};

export default async function TechnicianInvoicesPage() {
  const session = await getServerSession(authOptions);
  const { start, end } = dayBounds(new Date());

  const [settings, invoices] = await Promise.all([
    prisma.appSettings.findUnique({ where: { id: 1 } }),
    prisma.invoice.findMany({
      where: { createdById: session!.user.id, deletedAt: null, createdAt: { gte: start, lt: end } },
      include: { customer: true, payments: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);
  const currency = settings?.currencyCode ?? 'SCR';

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-ink-900">Today&apos;s Invoices</h1>
        <p className="text-sm text-slate-500">Invoices you&apos;ve raised today — reopen one to edit or re-send it.</p>
      </div>

      {invoices.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">
          No invoices raised today yet.
        </p>
      )}

      <div className="space-y-2">
        {invoices.map((inv) => {
          const pending = inv.payments.some((p) => p.verificationStatus === 'PENDING_REVIEW' || p.verificationStatus === 'MISMATCH');
          return (
            <Link
              key={inv.id}
              href={`/technician/invoice/${inv.id}`}
              className="block rounded-xl bg-white p-3 shadow-sm active:bg-slate-50"
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink-900">{inv.invoiceNumber}</p>
                  <p className="truncate text-xs text-slate-500">{inv.customer.displayName}</p>
                </div>
                <span className={`badge shrink-0 ${STATUS_STYLES[inv.status] ?? 'bg-slate-100 text-slate-600'}`}>{inv.status}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-slate-400">
                  {new Date(inv.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {inv.status === 'DRAFT' && <span className="ml-2 font-medium text-brand-600">✏️ Editable</span>}
                  {pending && <span className="ml-2 font-medium text-amber-600">🕒 Payment pending review</span>}
                </span>
                <span className="font-medium text-ink-900">
                  {formatMoney(inv.total.toString(), currency)}
                  {Number(inv.balanceDue) > 0 && inv.status !== 'DRAFT' && (
                    <span className="ml-1 text-amber-600">
                      ({formatMoney(inv.balanceDue.toString(), currency)} due)
                    </span>
                  )}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
