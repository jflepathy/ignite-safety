import { getServerSession } from 'next-auth';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isStaleAssignment } from '@/lib/work-order-status';
import PaymentCollector from '@/components/technician/payment-collector';

export default async function CollectPaymentPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: { customer: true, workOrder: true },
  });
  if (!invoice) notFound();

  const isAdminPreview = session!.user.role === 'ADMIN';
  if (!isAdminPreview) {
    const wo = invoice.workOrder;
    if (!wo || (wo.assignedTechnicianId !== session!.user.id && !isStaleAssignment(wo))) notFound();
  }

  const settings = await prisma.appSettings.findUnique({ where: { id: 1 } });
  const currency = settings?.currencyCode ?? 'SCR';
  const balanceDue = Number(invoice.balanceDue) > 0 ? Number(invoice.balanceDue) : Number(invoice.total);

  if (!settings?.technicianCollectionsBankAccountId) {
    return (
      <div className="space-y-4">
        <Link href={`/technician/invoice/${invoice.id}`} className="text-sm text-slate-500 hover:underline">
          ← Back
        </Link>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          Payment collection isn't set up yet — ask an admin to configure a collections account under Team &gt;
          Incentive Rates before you can receive a payment here.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Link href={`/technician/invoice/${invoice.id}`} className="text-sm text-slate-500 hover:underline">
        ← Back to invoice
      </Link>
      <PaymentCollector
        invoiceId={invoice.id}
        invoiceNumber={invoice.invoiceNumber}
        amountDue={balanceDue}
        currency={currency}
        payeeName={settings?.legalName || settings?.companyName || 'Ignite Safety'}
        bankName={settings?.bankName ?? null}
        bankAccountName={settings?.bankAccountName ?? null}
        bankAccountNumber={settings?.bankAccountNumber ?? null}
      />
    </div>
  );
}
