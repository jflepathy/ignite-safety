import type { InvoiceDocumentData } from '@/components/billing/invoice-document';
import { formatDate } from '@/lib/format-date';

type SettingsRow = {
  companyName?: string | null;
  companyAddress?: string | null;
  companyPhone?: string | null;
  companyEmail?: string | null;
  taxRegistrationNumber?: string | null;
  logoUrl?: string | null;
  paymentInstructions?: string | null;
  bankName?: string | null;
  bankAccountName?: string | null;
  bankAccountNumber?: string | null;
  currencyCode?: string | null;
} | null;

export function documentSettings(settings: SettingsRow): InvoiceDocumentData['settings'] {
  return {
    companyName: settings?.companyName ?? 'Ignite Safety',
    companyAddress: settings?.companyAddress ?? null,
    companyPhone: settings?.companyPhone ?? null,
    companyEmail: settings?.companyEmail ?? null,
    taxRegistrationNumber: settings?.taxRegistrationNumber ?? null,
    logoUrl: settings?.logoUrl ?? null,
    paymentInstructions: settings?.paymentInstructions ?? null,
    bankName: settings?.bankName ?? null,
    bankAccountName: settings?.bankAccountName ?? null,
    bankAccountNumber: settings?.bankAccountNumber ?? null,
  };
}

export function estimateDocumentData(estimate: any, settings: SettingsRow): InvoiceDocumentData {
  return {
    settings: documentSettings(settings),
    documentLabel: 'Estimate',
    documentNumber: estimate.estimateNumber,
    issueDate: formatDate(estimate.issueDate),
    customer: { displayName: estimate.customer.displayName, address: estimate.customer.address, phone: estimate.customer.phone },
    lineItems: estimate.lineItems.map((li: any) => ({
      id: li.id,
      sku: li.shopItem?.sku ?? null,
      description: li.description,
      quantity: li.quantity.toString(),
      unitPrice: li.unitPrice.toString(),
      discountPercent: li.discountPercent.toString(),
      taxName: li.taxRate?.name ?? null,
      lineTotal: li.lineTotal.toString(),
    })),
    currency: settings?.currencyCode ?? 'SCR',
    subtotal: estimate.subtotal.toString(),
    discountTotal: estimate.discountTotal.toString(),
    globalDiscountPercent: estimate.globalDiscountPercent.toString(),
    taxTotal: estimate.taxTotal.toString(),
    total: estimate.total.toString(),
    balanceDue: estimate.total.toString(),
    taxInclusive: estimate.taxInclusive,
    customerMessage: estimate.customerMessage,
    totalLabel: 'Total',
    showTaxNote: false,
  };
}

export function receiptDocumentData(receipt: any, settings: SettingsRow): InvoiceDocumentData {
  return {
    settings: documentSettings(settings),
    documentLabel: 'Sales Receipt',
    documentNumber: receipt.receiptNumber,
    issueDate: formatDate(receipt.saleDate),
    customer: { displayName: receipt.customer.displayName, address: receipt.customer.address, phone: receipt.customer.phone },
    lineItems: receipt.lineItems.map((li: any) => ({
      id: li.id,
      sku: li.shopItem?.sku ?? null,
      description: li.description,
      quantity: li.quantity.toString(),
      unitPrice: li.unitPrice.toString(),
      discountPercent: '0',
      taxName: li.taxRate?.name ?? null,
      lineTotal: li.lineTotal.toString(),
    })),
    currency: settings?.currencyCode ?? 'SCR',
    subtotal: receipt.subtotal.toString(),
    discountTotal: '0',
    globalDiscountPercent: '0',
    taxTotal: receipt.taxTotal.toString(),
    total: receipt.total.toString(),
    amountPaid: receipt.total.toString(),
    balanceDue: '0',
  };
}
