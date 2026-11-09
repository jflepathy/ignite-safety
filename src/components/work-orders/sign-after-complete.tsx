'use client';

import { useState } from 'react';
import SignaturePad from '@/components/technician/signature-pad';

/**
 * Lets a completed (Complete & Sync'd) work order still be signed by the
 * client when no signature was captured at completion. Saves through the
 * normal work-order PATCH without touching the status.
 */
export default function SignAfterComplete({
  workOrderId,
  initialName = '',
  onSaved,
}: {
  workOrderId: string;
  initialName?: string | null;
  onSaved?: (name: string, signatureDataUrl: string) => void;
}) {
  const [name, setName] = useState(initialName ?? '');
  const [signature, setSignature] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    if (!name.trim()) return setError('Enter the name of the person signing.');
    if (!signature) return setError('Capture the client signature first.');
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/work-orders/${workOrderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerSignedName: name.trim(), customerSignatureDataUrl: signature }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(typeof j.error === 'string' ? j.error : 'Could not save the signature - try again.');
      }
      if (onSaved) onSaved(name.trim(), signature);
      else window.location.reload();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="mb-2 text-sm font-semibold text-amber-800">Not yet signed by the client</p>
      <p className="mb-3 text-xs text-amber-700">This job is completed and synced, but has no client signature. You can capture it now.</p>
      <label className="label">Name of person signing</label>
      <input className="input mb-2" value={name} onChange={(e) => setName(e.target.value)} />
      {signature ? (
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={signature} alt="Customer signature" className="h-20 rounded border border-slate-200 bg-white" />
          <button type="button" className="mt-1 text-xs text-slate-500 underline" onClick={() => setOpen(true)}>
            Re-sign
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="w-full rounded-lg border-2 border-dashed border-slate-300 bg-white py-6 text-sm font-medium text-slate-500 hover:bg-slate-50"
          onClick={() => setOpen(true)}
        >
          ✍️ Tap to Sign Full Screen
        </button>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <button type="button" className="btn-primary mt-3 w-full py-2.5" disabled={saving || !signature} onClick={save}>
        {saving ? 'Saving…' : 'Save signature'}
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] flex flex-col bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h2 className="text-base font-semibold text-ink-900">Customer Signature</h2>
            <button type="button" className="text-slate-400 hover:text-ink-800" onClick={() => setOpen(false)}>
              ✕
            </button>
          </div>
          <div className="min-h-0 flex-1 p-4">
            <SignaturePad onChange={setPending} />
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-slate-200 p-4">
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={!pending}
              onClick={() => {
                setSignature(pending);
                setOpen(false);
              }}
            >
              Accept &amp; Use Signature
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
