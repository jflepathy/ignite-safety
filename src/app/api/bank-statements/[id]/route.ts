import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';

/** Undo an import: removes its statement lines. Documents created while reconciling stay. */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireRole('ADMIN');
  if (error) return error;
  const imp = await prisma.bankStatementImport.findUnique({ where: { id: params.id } });
  if (!imp) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const del = await prisma.bankTransaction.deleteMany({ where: { importId: imp.id } });
  await prisma.bankStatementImport.delete({ where: { id: imp.id } });
  try {
    await prisma.auditLog.create({
      data: { userId: session!.user.id, action: 'BANK_STATEMENT_IMPORT_UNDONE', entityType: 'BankAccount', entityId: imp.bankAccountId, metadata: { importId: imp.id, lines: del.count } },
    });
  } catch {
    /* best effort */
  }
  return NextResponse.json({ ok: true, removed: del.count });
}
