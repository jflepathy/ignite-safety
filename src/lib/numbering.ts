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
  | 'itemSkuNextSeq';

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
  | 'itemSkuPrefix';

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

  const settings = await prisma.$transaction(async (tx) => {
    const current = await tx.appSettings.findUnique({ where: { id: 1 } });
    if (!current) throw new Error('AppSettings not initialized. Run the seed script.');

    const nextSeq = current[seqField] + 1;
    const updated = await tx.appSettings.update({
      where: { id: 1 },
      data: { [seqField]: nextSeq },
    });
    return { prefix: current[prefixField], seq: current[seqField] };
  });

  const padded = String(settings.seq).padStart(4, '0');
  return `${settings.prefix}-${year}-${padded}`;
}

/** Same atomic-reservation pattern as nextDocumentNumber(), but for
 * auto-incrementing item SKUs/codes (no year segment, e.g. "ITM-0001").
 * Staff can still type a fully custom SKU instead — this is only used
 * when they click "Auto-generate". */
export async function nextItemSku(): Promise<string> {
  const settings = await prisma.$transaction(async (tx) => {
    const current = await tx.appSettings.findUnique({ where: { id: 1 } });
    if (!current) throw new Error('AppSettings not initialized. Run the seed script.');
    await tx.appSettings.update({ where: { id: 1 }, data: { itemSkuNextSeq: current.itemSkuNextSeq + 1 } });
    return { prefix: current.itemSkuPrefix, seq: current.itemSkuNextSeq };
  });
  const padded = String(settings.seq).padStart(4, '0');
  return `${settings.prefix}-${padded}`;
}
