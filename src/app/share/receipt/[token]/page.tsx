import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import PrintButton from '@/components/print-button';
import InvoiceDocument from '@/components/billing/invoice-document';
import { receiptDocumentData } from '@/lib/document-data';

// Public, unauthenticated view of a shared sales receipt (link-only access).
export const dynamic = 'force-dynamic';

export default async function SharedReceiptPage({ params }: { params: { token: string } }) {
  const receipt = await prisma.salesReceipt.findUnique({
    where: { shareToken: params.token },
    include: { customer: true, lineItems: { include: { taxRate: true, shopItem: true } } },
  });
  if (!receipt) notFound();
  const settings = await prisma.appSettings.findUnique({ where: { id: 1 } });
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-xl font-semibold text-ink-900">Sales Receipt {receipt.receiptNumber}</h1>
        <PrintButton />
      </div>
      <div className="print-area">
        <InvoiceDocument {...receiptDocumentData(receipt, settings)} />
      </div>
    </div>
  );
}
