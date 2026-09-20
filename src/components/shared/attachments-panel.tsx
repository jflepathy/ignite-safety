'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Attachment = { id: string; fileName: string; fileUrl: string; fileSizeBytes: number | null; createdAt: string };

function formatBytes(n: number | null) {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function AttachmentsPanel({
  entityType,
  entityId,
  attachments,
}: {
  entityType: string;
  entityId: string;
  attachments: Attachment[];
}) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function handleFile(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      setError('Files over 5MB are not supported yet.');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch('/api/attachments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityType, entityId, fileName: file.name, fileUrl: dataUrl, fileSizeBytes: file.size }),
      });
      if (!res.ok) throw new Error('Upload failed');
      router.refresh();
    } catch (e: any) {
      setError(e.message ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function remove(id: string) {
    await fetch(`/api/attachments/${id}`, { method: 'DELETE' });
    router.refresh();
  }

  return (
    <div className="card p-6 print:hidden">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink-900">Attachments</h2>
        <label className="btn-secondary cursor-pointer">
          {uploading ? 'Uploading…' : '+ Attach File'}
          <input
            type="file"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = '';
            }}
          />
        </label>
      </div>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      {attachments.length === 0 ? (
        <p className="text-sm text-slate-400">No files attached yet.</p>
      ) : (
        <ul className="space-y-2">
          {attachments.map((a) => (
            <li key={a.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <a href={a.fileUrl} download={a.fileName} className="truncate font-medium text-brand-600 hover:underline">
                {a.fileName}
              </a>
              <div className="flex items-center gap-3 text-slate-400">
                <span>{formatBytes(a.fileSizeBytes)}</span>
                <button onClick={() => remove(a.id)} className="hover:text-red-600">
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
