import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { rebuildLedgerTypes, SOURCE_TYPES, type SourceType } from '@/lib/ledger';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/** Admin: re-post every document of the listed types (?types=INVOICE,PAYMENT). */
export async function POST(req: NextRequest) {
  const { session, error } = await requireRole('ADMIN');
  if (error) return error;
  const types = (req.nextUrl.searchParams.get('types') ?? '')
    .split(',')
    .filter((t): t is SourceType => (SOURCE_TYPES as readonly string[]).includes(t));
  if (types.length === 0 || types.length > 4) return NextResponse.json({ error: 'Pass 1-4 types' }, { status: 400 });
  try {
    const result = await rebuildLedgerTypes(types);
    try {
      await prisma.auditLog.create({ data: { userId: session!.user.id, action: 'LEDGER_REBUILT', entityType: 'Ledger', entityId: types.join(','), metadata: result as any } });
    } catch {
      /* best effort */
    }
    return NextResponse.json({ ok: true, result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}
