import { prisma } from '@/lib/prisma';
import CreditNoteFormClient from '@/components/billing/credit-note-form-client';

export default async function NewCreditNotePage({ searchParams }: { searchParams: { invoiceId?: string } }) {
  const [customers, shopItems, taxRates, settings, invoice] = await Promise.all([
    prisma.customer.findMany({ where: { deletedAt: null }, orderBy: { displayName: 'asc' } }),
    prisma.shopItem.findMany({ where: { active: true }, orderBy: { sku: 'asc' } }),
    prisma.taxRate.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
    searchParams.invoiceId ? prisma.invoice.findUnique({ where: { id: searchParams.invoiceId } }) : null,
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">New Credit Note</h1>
        <p className="text-sm text-slate-500">
          {invoice ? `Crediting invoice ${invoice.invoiceNumber}` : 'Issue a credit against a customer’s account.'}
        </p>
      </div>
      <CreditNoteFormClient
        customers={customers.map((c) => ({ id: c.id, name: c.displayName }))}
        shopItems={shopItems.map((s) => ({ id: s.id, sku: s.sku, name: s.name, unitPrice: s.unitPrice.toString() }))}
        taxRates={taxRates.map((t) => ({ id: t.id, name: t.name, ratePercent: t.ratePercent.toString() }))}
        currency={settings?.currencyCode ?? 'SCR'}
        invoiceId={invoice?.id}
      />
    </div>
  );
}
