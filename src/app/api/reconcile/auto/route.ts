import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { autoMatch } from '@/lib/reconcile';

export async function POST(req: NextRequest) {
  const { error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;
  const { bankAccountId } = await req.json().catch(() => ({}));
  if (!bankAccountId) return NextResponse.json({ error: 'bankAccountId required' }, { status: 400 });
  const matched = await autoMatch(bankAccountId);
  return NextResponse.json({ ok: true, matched });
}
