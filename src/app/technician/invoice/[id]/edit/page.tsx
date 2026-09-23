import { getServerSession } from 'next-auth';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isStaleAssignment } from '@/lib/work-order-status';
import TechnicianInvoiceLineEditor from '@/components/technician/invoice-line-editor';

export default async function TechnicianEditInvoicePage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: { lineItems: { orderBy: { sortOrder: 'asc' } }, workOrder: true },
  });
  if (!invoice) notFound();

  const isAdminPreview = session!.user.role === 'ADMIN';
  if (!isAdminPreview) {
    const wo = invoice.workOrder;
    if (!wo || (wo.assignedTechnicianId !== session!.user.id && !isStaleAssignment(wo))) notFound();
  }

  const settings = await prisma.appSettings.findUnique({ where: { id: 1 } });
  const currency = settings?.currencyCode ?? 'SCR';

  if (invoice.status !== 'DRAFT') {
    return (
      <div className="space-y-4">
        <Link href={`/technician/invoice/${invoice.id}`} className="text-sm text-slate-500 hover:underline">
          ← Back to invoice
        </Link>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          This invoice has already been sent{invoice.status === 'PAID' ? ' and paid' : ''} — ask the office to make
          changes to it from here on.
        </div>
      </div>
    );
  }

  const shopItems = await prisma.shopItem.findMany({ where: { active: true }, orderBy: { sku: 'asc' } });

  return (
    <div className="space-y-5">
      <Link href={`/technician/invoice/${invoice.id}`} className="text-sm text-slate-500 hover:underline">
        ← Back to invoice
      </Link>
      <div>
        <h1 className="text-lg font-semibold text-ink-900">Edit {invoice.invoiceNumber}</h1>
        <p className="text-sm text-slate-500">Still a draft — fix quantities or add a missed item before sending.</p>
      </div>
      <TechnicianInvoiceLineEditor
        invoiceId={invoice.id}
        currency={currency}
        shopItems={shopItems.map((s) => ({ id: s.id, sku: s.sku, name: s.name, unitPrice: s.unitPrice.toString() }))}
        initialLines={invoice.lineItems.map((li) => ({
          key: li.id,
          shopItemId: li.shopItemId,
          description: li.description,
          quantity: Number(li.quantity),
          unitPrice: Number(li.unitPrice),
        }))}
      />
    </div>
  );
}
