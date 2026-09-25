import { prisma } from '@/lib/prisma';
import { formatDateTime } from '@/lib/format-date';

export default async function AuditLogPage() {
  const logs = await prisma.auditLog.findMany({
    include: { user: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">Audit Log</h1>
        <p className="text-sm text-slate-500">A record of key actions taken in the system.</p>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Entity</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-500">{formatDateTime(l.createdAt)}</td>
                <td className="px-4 py-3 text-ink-900">{l.user?.name ?? 'System'}</td>
                <td className="px-4 py-3 font-medium text-ink-900">{l.action}</td>
                <td className="px-4 py-3 text-slate-500">
                  {l.entityType}
                  {l.entityId ? ` #${l.entityId.slice(0, 8)}` : ''}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-slate-400">
                  No audit events recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
