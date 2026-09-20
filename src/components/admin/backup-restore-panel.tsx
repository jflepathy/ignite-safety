'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function BackupRestorePanel() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  async function exportBackup() {
    setExporting(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/backup/export');
      if (!res.ok) throw new Error('Export failed.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ignite-safety-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMessage({ kind: 'success', text: 'Backup downloaded.' });
    } catch (e: any) {
      setMessage({ kind: 'error', text: e.message ?? 'Export failed.' });
    } finally {
      setExporting(false);
    }
  }

  async function importBackup(file: File) {
    setImporting(true);
    setMessage(null);
    try {
      const text = await file.text();
      const res = await fetch('/api/admin/backup/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: text,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? 'Restore failed.');
      const totalRestored = Object.values(body.results ?? {}).reduce((s: number, r: any) => s + r.restored, 0);
      const totalFailed = Object.values(body.results ?? {}).reduce((s: number, r: any) => s + r.failed, 0);
      setMessage({
        kind: 'success',
        text: `Restore complete: ${totalRestored} record(s) restored${totalFailed ? `, ${totalFailed} skipped (see server logs)` : ''}.`,
      });
      router.refresh();
    } catch (e: any) {
      setMessage({ kind: 'error', text: e.message ?? 'Restore failed.' });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="space-y-6">
      <div className="card space-y-3 p-6">
        <h2 className="text-sm font-semibold text-ink-900">Backup</h2>
        <p className="text-sm text-slate-500">
          Download a full JSON snapshot of the business data in this system — customers, catalog, servicing, work
          orders, invoicing/accounting, expenses and payroll records. Since the database runs on a managed cloud host
          with no direct file-system access, this application-level export is the backup mechanism: keep the
          downloaded file somewhere safe (it is not stored anywhere else).
        </p>
        <button className="btn-primary" disabled={exporting} onClick={exportBackup}>
          {exporting ? 'Preparing…' : '⬇ Download Backup (JSON)'}
        </button>
      </div>

      <div className="card space-y-3 p-6">
        <h2 className="text-sm font-semibold text-ink-900">Restore</h2>
        <p className="text-sm text-slate-500">
          Upload a previously downloaded backup file to restore its records. Restoring is additive: existing records
          with a matching ID are updated in place, and anything created since the backup was taken is left alone —
          nothing is deleted.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          disabled={importing}
          onChange={(e) => e.target.files?.[0] && importBackup(e.target.files[0])}
          className="text-sm"
        />
        {importing && <p className="text-sm text-slate-500">Restoring…</p>}
      </div>

      {message && (
        <p className={`text-sm ${message.kind === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>{message.text}</p>
      )}
    </div>
  );
}
