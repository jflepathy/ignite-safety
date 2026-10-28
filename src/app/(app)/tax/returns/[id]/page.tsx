import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { computeVatFigures } from '@/lib/vat';
import VatReturnWorksheet from '@/components/tax/vat-return-worksheet';

export default async function VatReturnPage({ params }: { params: { id: string } }) {
  const [vr, settings] = await Promise.all([prisma.vatReturn.findUnique({ where: { id: params.id } }), prisma.appSettings.findUnique({ where: { id: 1 } })]);
  if (!vr) notFound();
  // Live figures shown next to the saved ones so the user can see if anything changed since the draft was prepared.
  const live = vr.status === 'DRAFT' ? await computeVatFigures(vr.periodStart, vr.periodEnd) : null;
  const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <Link href="/tax" className="text-sm text-slate-500 hover:underline">← Tax Center</Link>
      </div>
      <VatReturnWorksheet
        currency={settings?.currencyCode ?? 'SCR'}
        company={{ name: settings?.companyName ?? 'Ignite Safety', tin: settings?.taxRegistrationNumber ?? null }}
        liveOutput={live?.outputTax ?? null}
        liveInput={live?.inputTax ?? null}
        counts={live ? { invoices: live.invoiceCount, receipts: live.receiptCount, creditNotes: live.creditNoteCount, bills: live.billCount, purchases: live.purchases } : null}
        r={{
          id: vr.id,
          start: iso(vr.periodStart)!,
          end: iso(vr.periodEnd)!,
          due: iso(vr.dueDate)!,
          status: vr.status,
          totalSales: Number(vr.totalSales),
          taxableSales: Number(vr.taxableSales),
          outputTax: Number(vr.outputTax),
          inputTax: Number(vr.inputTax),
          outputAdjustment: Number(vr.outputAdjustment),
          inputAdjustment: Number(vr.inputAdjustment),
          netPayable: Number(vr.netPayable),
          notes: vr.notes,
          filedAt: iso(vr.filedAt),
          filedReference: vr.filedReference,
          paidAt: iso(vr.paidAt),
          paidAmount: vr.paidAmount != null ? Number(vr.paidAmount) : null,
          paymentReference: vr.paymentReference,
        }}
      />
    </div>
  );
}
