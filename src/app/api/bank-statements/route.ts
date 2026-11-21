import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { z } from 'zod';
import { autoMatch } from '@/lib/reconcile';

export const dynamic = 'force-dynamic';

/**
 * Import parsed bank statement lines (parsing happens in the browser, see
 * src/lib/statement-parse.ts). Lines already imported for this bank are skipped
 * (same date, amount, description and position), then auto-match runs.
 */
const Row = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().max(500),
  reference: z.string().max(120).optional().nullable(),
  amount: z.number().refine((n) => n !== 0),
  balance: z.number().optional().nullable(),
});
const Schema = z.object({
  bankAccountId: z.string().min(1),
  fileName: z.string().max(200).optional().nullable(),
  openingBalance: z.number().optional().nullable(),
  closingBalance: z.number().optional().nullable(),
  rows: z.array(Row).min(1).max(1500),
});

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60);

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;
  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const d = parsed.data;
  const bank = await prisma.bankAccount.findUnique({ where: { id: d.bankAccountId } });
  if (!bank) return NextResponse.json({ error: { formErrors: ['That bank account no longer exists.'] } }, { status: 400 });

  const dates = d.rows.map((r) => r.date).sort();
  const imp = await prisma.bankStatementImport.create({
    data: {
      bankAccountId: bank.id,
      fileName: d.fileName ?? null,
      fromDate: new Date(`${dates[0]}T00:00:00Z`),
      toDate: new Date(`${dates[dates.length - 1]}T00:00:00Z`),
      openingBalance: d.openingBalance ?? null,
      closingBalance: d.closingBalance ?? null,
      rowCount: d.rows.length,
      createdById: session!.user.id,
    },
  });

  const seen = new Map<string, number>();
  let inserted = 0;
  for (let i = 0; i < d.rows.length; i += 250) {
    const chunk = d.rows.slice(i, i + 250);
    const params: any[] = [];
    const values = chunk.map((r) => {
      const base = `${r.date}|${r.amount.toFixed(2)}|${norm(r.description)}`;
      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);
      const b = params.length;
      params.push(
        `bt${crypto.randomUUID().replace(/-/g, '').slice(0, 23)}`,
        bank.id,
        new Date(`${r.date}T00:00:00Z`),
        r.description.slice(0, 500),
        r.amount,
        r.reference ?? null,
        r.balance ?? null,
        imp.id,
        `${base}|${n}`
      );
      return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5}::numeric,$${b + 6},$${b + 7}::numeric,$${b + 8},$${b + 9},false,false,now())`;
    });
    const res: any[] = await prisma.$queryRawUnsafe(
      `INSERT INTO "bank_transactions" ("id","bankAccountId","date","description","amount","reference","balance","importId","dedupeKey","reconciled","excluded","createdAt")
       VALUES ${values.join(',')}
       ON CONFLICT ("bankAccountId","dedupeKey") DO NOTHING RETURNING "id"`,
      ...params
    );
    inserted += res.length;
  }
  if (inserted === 0) {
    // Nothing new (the whole statement was imported before): don't keep an empty import.
    await prisma.bankStatementImport.delete({ where: { id: imp.id } });
    return NextResponse.json({ ok: true, importId: null, rows: d.rows.length, inserted: 0, skipped: d.rows.length, autoMatched: 0 });
  }
  await prisma.bankStatementImport.update({ where: { id: imp.id }, data: { importedCount: inserted } });
  const matched = await autoMatch(bank.id);
  try {
    await prisma.auditLog.create({
      data: { userId: session!.user.id, action: 'BANK_STATEMENT_IMPORTED', entityType: 'BankAccount', entityId: bank.id, metadata: { importId: imp.id, rows: d.rows.length, inserted, matched } },
    });
  } catch {
    /* best effort */
  }
  return NextResponse.json({ ok: true, importId: imp.id, rows: d.rows.length, inserted, skipped: d.rows.length - inserted, autoMatched: matched });
}
