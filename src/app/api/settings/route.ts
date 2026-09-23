import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';

export async function GET() {
  const { error } = await requireRole('ADMIN', 'SALES', 'TECHNICIAN');
  if (error) return error;
  const settings = await prisma.appSettings.findUnique({ where: { id: 1 } });
  return NextResponse.json(settings);
}

export async function PATCH(req: NextRequest) {
  const { session, error } = await requireRole('ADMIN');
  if (error) return error;

  const body = await req.json();
  // Whitelist updatable fields (numbering sequence counters are managed
  // exclusively by nextDocumentNumber() and excluded here).
  const allowed = [
    // Company & Account
    'companyName',
    'legalName',
    'companyAddress',
    'companyPhone',
    'companyEmail',
    'taxRegistrationNumber',
    'businessRegistrationNumber',
    'registeredOwners',
    'businessType',
    'industry',
    'currencyCode',
    'logoUrl',
    'faviconUrl',
    'invoiceTermsDefault',
    'paymentInstructions',
    'bankName',
    'bankAccountName',
    'bankAccountNumber',
    'chartOfAccountsLimit',
    'billableUserLimit',
    'customKpiLimit',
    // Sales Settings
    'preferredPaymentTerms',
    'deliveryMethod',
    'customFieldsEnabled',
    'transactionNumberingEnabled',
    'serviceDateEnabled',
    'discountsEnabled',
    'depositsOnSalesEnabled',
    'tagsEnabled',
    'skuTrackingEnabled',
    'priceRulesEnabled',
    'inventoryReceivingEnabled',
    'progressInvoicingEnabled',
    // Messages & Reminders
    'defaultInvoiceEmailSubject',
    'defaultInvoiceEmailBody',
    'autoPaymentRemindersEnabled',
    'reminderScheduleDays',
    // Customer Feedback & AI
    'dailyDigestEnabled',
    'autoSurveyRequestsEnabled',
    // Expenses Settings
    'expenseItemizationEnabled',
    'expenseTaggingEnabled',
    'billableExpenseTrackingEnabled',
    'defaultBillTermsDays',
    'purchaseOrdersEnabled',
    // Time Tracking
    'weekStartDay',
    'timesheetFields',
    'billableTimeEnabled',
    // Advanced & Financial Preferences
    'accountingMethod',
    'fiscalYearStartMonth',
    'taxYearStartMonth',
    'booksClosedDate',
    'multiCurrencyEnabled',
    'baseCurrency',
    'fxAutoUpdateEnabled',
    'fxRateLockEnabled',
    'autoPrefillFormsEnabled',
    'autoApplyBillPaymentsEnabled',
    'projectTrackingEnabled',
    'numberFormat',
    'warnOnDuplicateCheckNumber',
    'warnOnDuplicateBillNumber',
    // Numbering
    'invoicePrefix',
    'estimatePrefix',
    'creditNotePrefix',
    'workOrderPrefix',
    'serviceRequestPrefix',
    'salesOrderPrefix',
    'salesReceiptPrefix',
    'refundReceiptPrefix',
    'billPrefix',
    'purchaseOrderPrefix',
    'supplierCreditPrefix',
    'journalEntryPrefix',
    'itemSkuPrefix',
    // Scheduling & Dispatch
    'dailyTeamCapacity',
    'smartRemindersEnabled',
    'overdueThresholdDays',
    'defaultServiceIntervalMonths',
    'reminderLeadDays',
    'requireCustomerSignoff',
    // Technician Incentive Program
    'defaultIncentiveFraction',
    'technicianCollectionsBankAccountId',
    // Tax & Financial
    'defaultTaxRateId',
    'taxInclusivePricing',
    'discountLimitPercent',
    'allowedPaymentMethods',
    // UI Customization
    'uiModules',
  ];
  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) data[key] = body[key];
  }

  const updated = await prisma.appSettings.update({
    where: { id: 1 },
    data: { ...data, updatedById: session!.user.id },
  });

  await prisma.auditLog.create({
    data: { userId: session!.user.id, action: 'SETTINGS_UPDATED', entityType: 'AppSettings', entityId: '1', metadata: data as any },
  });

  return NextResponse.json(updated);
}
