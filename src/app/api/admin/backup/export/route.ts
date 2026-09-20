import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { serializePlain } from '@/lib/serialize';
import { MODEL_ORDER, BACKUP_FORMAT_VERSION } from '@/lib/backup';

export async function GET() {
  const { session, error } = await requireRole('ADMIN');
  if (error) return error;

  const data: Record<string, unknown[]> = {};
  for (const model of MODEL_ORDER) {
    const delegate = (prisma as any)[model];
    // eslint-disable-next-line no-await-in-loop
    const rows = await delegate.findMany();
    data[model] = serializePlain(rows);
  }

  await prisma.auditLog.create({
    data: { userId: session!.user.id, action: 'BACKUP_EXPORTED', entityType: 'AppSettings', entityId: '1' },
  });

  const payload = {
    format: 'ignite-safety-backup',
    version: BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    models: MODEL_ORDER,
    data,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="ignite-safety-backup-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
