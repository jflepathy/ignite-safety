/**
 * In-app data Backup & Restore.
 *
 * The production database is Supabase Postgres reached only through
 * pooled/direct connection strings — there is no shell access or pg_dump
 * available from this serverless app, so "backup" here means an
 * application-level export: Admin downloads a JSON snapshot of the core
 * business tables through the app itself, and can re-upload that file to
 * restore (upsert) records back in. This is not a raw binary Postgres dump.
 *
 * MODEL_ORDER is dependency-ordered (parents before children) so a full
 * restore into an empty-ish database doesn't trip foreign-key errors.
 * Deliberately excluded: User / UserPermissionOverride (avoids shipping
 * password hashes in a downloadable file and avoids restoring accounts
 * that could collide with the live login set), Attachment (base64 file
 * blobs would make the export unreasonably large), AuditLog (a log, not
 * business data to restore), Tag/TaggedEntity/CustomField/RecurringTemplate/
 * DailyCapacityOverride/BankTransaction (lower-value list/tool records).
 */
export const MODEL_ORDER = [
  'taxRate',
  'account',
  'supplier',
  'customer',
  'customerSite',
  'equipmentTypeCatalog',
  'equipment',
  'shopItem',
  'employee',
  'bankAccount',
  'serviceRequest',
  'serviceRequestEquipmentCount',
  'workOrder',
  'workOrderInspectionItem',
  'invoice',
  'invoiceLineItem',
  'estimate',
  'estimateLineItem',
  'creditNote',
  'creditNoteLineItem',
  'salesOrder',
  'salesOrderLineItem',
  'salesReceipt',
  'salesReceiptLineItem',
  'refundReceipt',
  'refundReceiptLineItem',
  'bill',
  'billLineItem',
  'supplierPayment',
  'purchaseOrder',
  'purchaseOrderLineItem',
  'supplierCredit',
  'payment',
  'expense',
  'timeActivity',
  'deposit',
  'accountTransfer',
  'journalEntry',
  'journalLine',
  'inventoryAdjustment',
  'exchangeRate',
  'lead',
  'opportunity',
  'appSettings',
] as const;

export const BACKUP_FORMAT_VERSION = 1;

/** Recursively re-hydrate ISO-8601 date-like strings back into Date
 * objects before handing a record to Prisma on restore. JSON has no Date
 * type, so every DateTime field round-trips as a string; Prisma's Decimal
 * fields, on the other hand, accept plain strings directly. */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

export function rehydrateDates<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string' && ISO_DATE_RE.test(value)) {
    return new Date(value) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => rehydrateDates(v)) as unknown as T;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = rehydrateDates(v);
    }
    return out as T;
  }
  return value;
}
