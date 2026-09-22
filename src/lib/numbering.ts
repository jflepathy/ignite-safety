// Explicit "/wasm" import, left external — see src/lib/prisma.ts for why.
import { Prisma } from '@prisma/client/wasm';
import { prisma } from '@/lib/prisma';

type SeqField =
  | 'invoiceNextSeq'
  | 'estimateNextSeq'
  | 'creditNoteNextSeq'
  | 'workOrderNextSeq'
  | 'serviceRequestNextSeq'
  | 'salesOrderNextSeq'
  | 'salesReceiptNextSeq'
  | 'refundReceiptNextSeq'
  | 'billNextSeq'
  | 'purchaseOrderNextSeq'
  | 'supplierCreditNextSeq'
  | 'journalEntryNextSeq'
  | 'itemSkuNextSeq'
  | 'expenseNextSeq';

type PrefixField =
  | 'invoicePrefix'
  | 'estimatePrefix'
  | 'creditNotePrefix'
  | 'workOrderPrefix'
  | 'serviceRequestPrefix'
  | 'salesOrderPrefix'
  | 'salesReceiptPrefix'
  | 'refundReceiptPrefix'
  | 'billPrefix'
  | 'purchaseOrderPrefix'
  | 'supplierCreditPrefix'
  | 'journalEntryPrefix'
  | 'itemSkuPrefix'
  | 'expensePrefix';

// Field names above come only from the fixed SeqField/PrefixField unions
// (never user input), so interpolating them as column names below is safe.

/**
 * Atomically reserves the next sequence value for a counter column and
 * returns the reserved number plus the prefix, in one round trip.
 *
 * This used to be `prisma.$transaction(async (tx) => { read; write })`, but
 * the Neon HTTP driver adapter (needed to run on Cloudflare Workers) doesn't
 * support Prisma transactions. A single `UPDATE ... RETURNING` is actually
 * the more correct way to do this anyway — one atomic statement the
 * database itself serializes, with no read-modify-write race window at all
 * (the old transaction still had one under Postgres's default isolation
 * level; this raw increment doesn't).
 */
async function reserveNextSeq(
  seqField: SeqField,
  prefixField: PrefixField
): Promise<{ prefix: string; seq: number }> {
  const seqCol = Prisma.raw(`"${seqField}"`);
  const prefixCol = Prisma.raw(`"${prefixField}"`);
  const rows = await prisma.$queryRaw<{ prefix: string; seq: number }[]>(Prisma.sql`
    UPDATE "app_settings"
    SET ${seqCol} = ${seqCol} + 1
    WHERE id = 1
    RETURNING ${prefixCol} AS prefix, ${seqCol} - 1 AS seq
  `);
  const settings = rows[0];
  if (!settings) throw new Error('AppSettings not initialized. Run the seed script.');
  return settings;
}

/**
 * Atomically reserves the next sequence number for a document type and
 * returns a formatted document number, e.g. "WO-2026-0388".
 * Numbering pattern & prefixes are fully admin-configurable (Module D).
 */
export async function nextDocumentNumber(
  seqField: SeqField,
  prefixField: PrefixField
): Promise<string> {
  const year = new Date().getFullYear();
  const settings = await reserveNextSeq(seqField, prefixField);
  const padded = String(settings.seq).padStart(4, '0');
  // An empty prefix (admin-configurable) yields a bare "{year}-{seq}" form,
  // matching QuickBooks' own numbering style (no letter prefix) — used for
  // Invoice/Sales Receipt/Estimate since the 22 Sep 2026 QuickBooks migration.
  return settings.prefix ? `${settings.prefix}-${year}-${padded}` : `${year}-${padded}`;
}

/** Same atomic-reservation pattern as nextDocumentNumber(), but for
 * auto-incrementing item SKUs/codes (no year segment, e.g. "ITM-0001").
 * Staff can still type a fully custom SKU instead — this is only used
 * when they click "Auto-generate". */
export async function nextItemSku(): Promise<string> {
  const settings = await reserveNextSeq('itemSkuNextSeq', 'itemSkuPrefix');
  const padded = String(settings.seq).padStart(4, '0');
  return `${settings.prefix}-${padded}`;
}
