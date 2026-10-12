// Explicit "/wasm" import, left external — same reason as src/lib/numbering.ts.
import { Prisma } from '@prisma/client/wasm';
import { prisma } from '@/lib/prisma';

// Session 22, round 19 — one INSERT for every line of a document.
//
// Line items used to be inserted one `create()` at a time (createMany() needs
// a transaction, which the Neon HTTP adapter can't run). On Cloudflare
// Workers every one of those is a separate outbound request, and a single
// request is capped at 50 — so a long quote (a real 45-line estimate hit
// this) failed with a bare 500 on save. A multi-row INSERT is one request no
// matter how many lines there are.

type Row = {
  shopItemId?: string | null;
  description: string;
  quantity: number | string | { toString(): string };
  unitPrice: number | string | { toString(): string };
  discountPercent?: number | string | { toString(): string };
  taxRateId?: string | null;
  lineTotal: number | string | { toString(): string };
  sortOrder?: number;
};

const num = (v: { toString(): string } | number | string | undefined) => Number(v?.toString() ?? 0);
const newId = () => 'c' + crypto.randomUUID().replace(/-/g, '').slice(0, 24);
const CHUNK = 400;

export async function insertEstimateOrInvoiceLines(
  kind: 'estimate' | 'invoice',
  parentId: string,
  rows: Row[]
) {
  const table = Prisma.raw(kind === 'estimate' ? '"estimate_line_items"' : '"invoice_line_items"');
  const parentCol = Prisma.raw(kind === 'estimate' ? '"estimateId"' : '"invoiceId"');
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const values = chunk.map(
      (r, j) =>
        Prisma.sql`(${newId()}, ${parentId}, ${r.shopItemId || null}, ${r.description}, ${num(r.quantity)}, ${num(r.unitPrice)}, ${num(r.discountPercent)}, ${r.taxRateId || null}, ${num(r.lineTotal)}, ${r.sortOrder ?? i + j})`
    );
    await prisma.$executeRaw(
      Prisma.sql`INSERT INTO ${table} ("id", ${parentCol}, "shopItemId", "description", "quantity", "unitPrice", "discountPercent", "taxRateId", "lineTotal", "sortOrder") VALUES ${Prisma.join(values)}`
    );
  }
}

export async function insertSalesReceiptLines(receiptId: string, rows: Row[]) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const values = chunk.map(
      (r) =>
        Prisma.sql`(${newId()}, ${receiptId}, ${r.shopItemId || null}, ${r.description}, ${num(r.quantity)}, ${num(r.unitPrice)}, ${r.taxRateId || null}, ${num(r.lineTotal)})`
    );
    await prisma.$executeRaw(
      Prisma.sql`INSERT INTO "sales_receipt_line_items" ("id", "salesReceiptId", "shopItemId", "description", "quantity", "unitPrice", "taxRateId", "lineTotal") VALUES ${Prisma.join(values)}`
    );
  }
}
