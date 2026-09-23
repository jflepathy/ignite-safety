import { prisma } from '@/lib/prisma';

/**
 * Admin-only audit trail for a Work Order — who claimed it, who it was
 * (re)assigned to, and when its status changed (Session 12). Best-effort:
 * a logging failure must never break the write it's describing, so this
 * always swallows its own errors.
 */
export async function logWorkOrderHistory(params: {
  workOrderId: string;
  action: 'CREATED' | 'CLAIMED' | 'ASSIGNED' | 'STATUS_CHANGED' | 'COMPLETED' | 'DELETED' | 'TECHNICIANS_CHANGED';
  detail?: string;
  byUserId?: string | null;
  byUserName?: string | null;
}) {
  try {
    await prisma.workOrderHistoryEntry.create({
      data: {
        workOrderId: params.workOrderId,
        action: params.action,
        detail: params.detail ?? null,
        byUserId: params.byUserId ?? null,
        byUserName: params.byUserName ?? null,
      },
    });
  } catch (e) {
    console.error('Failed to log work order history', e);
  }
}
