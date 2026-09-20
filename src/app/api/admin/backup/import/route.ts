import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { MODEL_ORDER, rehydrateDates } from '@/lib/backup';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole('ADMIN');
  if (error) return error;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Uploaded file is not valid JSON.' }, { status: 400 });
  }

  if (body?.format !== 'ignite-safety-backup' || !body?.data) {
    return NextResponse.json({ error: 'This does not look like an Ignite Safety backup file.' }, { status: 400 });
  }

  const results: Record<string, { restored: number; failed: number }> = {};

  // Restore is an upsert per record, in dependency order (parents before
  // children) — existing rows with a matching id are updated in place,
  // rows the current database doesn't have are created. Nothing is
  // deleted, so restoring never silently wipes data created since the
  // backup was taken.
  for (const model of MODEL_ORDER) {
    const rows: any[] = Array.isArray(body.data[model]) ? body.data[model] : [];
    const delegate = (prisma as any)[model];
    let restored = 0;
    let failed = 0;
    for (const raw of rows) {
      const record = rehydrateDates(raw);
      try {
        // eslint-disable-next-line no-await-in-loop
        await delegate.upsert({ where: { id: record.id }, create: record, update: record });
        restored += 1;
      } catch {
        failed += 1;
      }
    }
    if (rows.length > 0) results[model] = { restored, failed };
  }

  await prisma.auditLog.create({
    data: { userId: session!.user.id, action: 'BACKUP_RESTORED', entityType: 'AppSettings', entityId: '1', metadata: results as any },
  });

  return NextResponse.json({ ok: true, results });
}
