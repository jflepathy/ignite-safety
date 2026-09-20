'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import SignaturePad from './signature-pad';

type ServiceLine = { key: string; label: string; quantity: number; kind: 'STANDARD' | 'CUSTOM' | 'WORKSHOP' };

type WorkOrder = {
  id: string;
  woNumber: string;
  status: string;
  serviceType: string;
  customerName: string;
  contactPerson: string | null;
  phone: string | null;
  locationDetails: string | null;
  scheduledDate: string | null;
  technicianNotes: string | null;
  serviceLines: ServiceLine[];
  invoiceNumberIfIssued: string | null;
  customerSignedName: string | null;
  customerSignatureDataUrl: string | null;
};

const STANDARD_ITEMS: { key: string; label: string }[] = [
  { key: 'fext', label: 'F/Ext' },
  { key: 'fblanket', label: 'F/Blanket' },
  { key: 'fhosereel', label: 'F/Hosereel' },
  { key: 'suppression', label: 'Suppression' },
  { key: 'detectors', label: 'Detectors' },
];

const WORKSHOP_ACTIONS: { key: string; label: string }[] = [
  { key: 'rust', label: 'Rust Treatment' },
  { key: 'pressurize', label: 'Pressurize' },
  { key: 'valvechange', label: 'Valve Change' },
];

export default function PosClient({ workOrder }: { workOrder: WorkOrder }) {
  const router = useRouter();
  const [status, setStatus] = useState(workOrder.status);
  const [lines, setLines] = useState<ServiceLine[]>(workOrder.serviceLines ?? []);
  const [customLabel, setCustomLabel] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState(workOrder.invoiceNumberIfIssued ?? '');
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [invoiceSaved, setInvoiceSaved] = useState(false);
  const [signedName, setSignedName] = useState(workOrder.customerSignedName ?? '');
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(workOrder.customerSignatureDataUrl);
  const [showSignatureCanvas, setShowSignatureCanvas] = useState(false);
  const [pendingSignature, setPendingSignature] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const totalUnitsAffected = lines.reduce((s, l) => s + l.quantity, 0);
  const isCompleted = status === 'COMPLETED';

  // Sync the cart to the server as it changes, so a technician's taps
  // aren't lost if the device loses connectivity before "Complete & Sync".
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/work-orders/${workOrder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceLines: lines, status: status === 'PENDING' || status === 'SCHEDULED' ? 'IN_PROGRESS' : undefined }),
      }).then(() => {
        if (status === 'PENDING' || status === 'SCHEDULED') setStatus('IN_PROGRESS');
      });
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines]);

  function tapItem(key: string, label: string, kind: ServiceLine['kind']) {
    if (isCompleted) return;
    setLines((prev) => {
      const existing = prev.find((l) => l.key === key);
      if (existing) return prev.map((l) => (l.key === key ? { ...l, quantity: l.quantity + 1 } : l));
      return [...prev, { key, label, quantity: 1, kind }];
    });
  }

  function addCustom() {
    if (!customLabel.trim()) return;
    tapItem(`custom-${customLabel.trim().toLowerCase()}`, customLabel.trim(), 'CUSTOM');
    setCustomLabel('');
  }

  function adjustQty(key: string, delta: number) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, quantity: Math.max(0, l.quantity + delta) } : l)).filter((l) => l.quantity > 0));
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  async function saveInvoiceNumber() {
    setSavingInvoice(true);
    setInvoiceSaved(false);
    try {
      await fetch(`/api/work-orders/${workOrder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceNumberIfIssued: invoiceNumber }),
      });
      setInvoiceSaved(true);
    } finally {
      setSavingInvoice(false);
    }
  }

  function acceptSignature() {
    if (!pendingSignature) return;
    setSignatureDataUrl(pendingSignature);
    setShowSignatureCanvas(false);
  }

  async function completeAndSync() {
    if (!signedName || !signatureDataUrl) {
      setError('Customer name and signature are both required before completing.');
      return;
    }
    setCompleting(true);
    setError('');
    try {
      const res = await fetch(`/api/work-orders/${workOrder.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerSignedName: signedName,
          customerSignatureDataUrl: signatureDataUrl,
          serviceLines: lines,
          invoiceNumberIfIssued: invoiceNumber,
        }),
      });
      if (!res.ok) throw new Error('Failed to complete & sync this work order.');
      setStatus('COMPLETED');
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCompleting(false);
    }
  }

  async function deleteWorkOrder() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/work-orders/${workOrder.id}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/technician');
        router.refresh();
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-50">
      {/* Header */}
      <div className="app-shell-chrome flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-base font-semibold text-ink-900">{workOrder.customerName}</p>
            <span className="badge bg-slate-100 text-slate-600">{workOrder.woNumber}</span>
          </div>
          <p className="truncate text-xs text-slate-500">
            {workOrder.locationDetails ?? 'No location set'} · {workOrder.contactPerson ?? '—'} {workOrder.phone ? `· ${workOrder.phone}` : ''} ·{' '}
            {workOrder.scheduledDate ? new Date(workOrder.scheduledDate).toLocaleDateString() : 'Unscheduled'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            title="Print"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-lg hover:bg-slate-100"
            onClick={() => window.print()}
          >
            🖨
          </button>
          <button
            type="button"
            title="Delete"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-lg text-red-600 hover:bg-red-50"
            onClick={() => setConfirmingDelete(true)}
          >
            🗑
          </button>
          <button
            type="button"
            title="Close"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-lg hover:bg-slate-100"
            onClick={() => router.push('/technician')}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Print-only summary */}
      <div className="print-area hidden print:block print:p-8">
        <h1 className="text-xl font-bold">{workOrder.woNumber} — {workOrder.customerName}</h1>
        <p className="text-sm text-slate-600">{workOrder.locationDetails}</p>
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-1">Item</th>
              <th className="py-1 text-right">Qty</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.key} className="border-b">
                <td className="py-1">{l.label}</td>
                <td className="py-1 text-right">{l.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-sm font-semibold">Total Units Affected: {totalUnitsAffected}</p>
        {invoiceNumber && <p className="text-sm">Invoice #: {invoiceNumber}</p>}
        {signedName && <p className="mt-4 text-sm">Signed: {signedName}</p>}
        {signatureDataUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={signatureDataUrl} alt="signature" className="mt-1 h-20" />
        )}
      </div>

      {/* Main POS layout */}
      <div className="grid flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 print:hidden lg:grid-cols-2">
        {/* Left panel: cart */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm">
            <span className="text-sm font-semibold text-ink-900">TOTAL UNITS AFFECTED</span>
            <span className="text-2xl font-bold text-brand-600">{totalUnitsAffected}</span>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto">
            {lines.length === 0 && (
              <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">
                Tap items on the right to add them here.
              </p>
            )}
            {lines.map((l) => (
              <div key={l.key} className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm">
                <div>
                  <p className="text-sm font-medium text-ink-900">{l.label}</p>
                  <p className="text-xs text-slate-400">{l.kind === 'WORKSHOP' ? 'Workshop action' : l.kind === 'CUSTOM' ? 'Custom' : 'Standard'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isCompleted}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 text-lg font-medium hover:bg-slate-50 disabled:opacity-40"
                    onClick={() => adjustQty(l.key, -1)}
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-base font-semibold">{l.quantity}</span>
                  <button
                    type="button"
                    disabled={isCompleted}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 text-lg font-medium hover:bg-slate-50 disabled:opacity-40"
                    onClick={() => adjustQty(l.key, 1)}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    disabled={isCompleted}
                    className="ml-1 text-xs text-red-600 hover:underline disabled:opacity-40"
                    onClick={() => removeLine(l.key)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl bg-white p-3 shadow-sm">
            <label className="label">Invoice Number (IF ISSUED)</label>
            <div className="flex gap-2">
              <input
                className="input"
                value={invoiceNumber}
                disabled={isCompleted}
                onChange={(e) => {
                  setInvoiceNumber(e.target.value);
                  setInvoiceSaved(false);
                }}
                placeholder="e.g. INV-2026-0143"
              />
              <button type="button" className="btn-secondary shrink-0" disabled={savingInvoice || isCompleted} onClick={saveInvoiceNumber}>
                {savingInvoice ? '…' : 'Save'}
              </button>
            </div>
            {invoiceSaved && <p className="mt-1 text-xs text-emerald-600">Saved ✓</p>}
          </div>

          <div className="rounded-xl bg-white p-3 shadow-sm">
            <label className="label">Customer Name (for sign-off)</label>
            <input className="input mb-2" value={signedName} disabled={isCompleted} onChange={(e) => setSignedName(e.target.value)} />
            {signatureDataUrl ? (
              <div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={signatureDataUrl} alt="Customer signature" className="h-20 rounded border border-slate-200 bg-white" />
                {!isCompleted && (
                  <button type="button" className="mt-1 text-xs text-slate-500 underline" onClick={() => setShowSignatureCanvas(true)}>
                    Re-sign
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                disabled={isCompleted}
                className="w-full rounded-lg border-2 border-dashed border-slate-300 py-6 text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                onClick={() => setShowSignatureCanvas(true)}
              >
                ✍️ Tap to Sign Full Screen
              </button>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {isCompleted ? (
            <p className="rounded-xl bg-emerald-50 p-4 text-center text-sm font-medium text-emerald-700">
              ✓ Completed &amp; synced. Ready for billing.
            </p>
          ) : (
            <button className="btn-primary w-full py-3 text-base" disabled={completing} onClick={completeAndSync}>
              {completing ? 'Syncing…' : '✓ Complete & Sync'}
            </button>
          )}
        </div>

        {/* Right panel: quick-tap grids */}
        <div className="space-y-4">
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-ink-900">Standard Servicing</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {STANDARD_ITEMS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  disabled={isCompleted}
                  className="flex h-20 flex-col items-center justify-center rounded-xl border-2 border-brand-200 bg-brand-50 text-center text-sm font-semibold text-brand-700 active:scale-95 active:bg-brand-100 disabled:opacity-40"
                  onClick={() => tapItem(item.key, item.label, 'STANDARD')}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                className="input"
                placeholder="Custom equipment…"
                value={customLabel}
                disabled={isCompleted}
                onChange={(e) => setCustomLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCustom()}
              />
              <button type="button" className="btn-secondary shrink-0" disabled={isCompleted} onClick={addCustom}>
                + Add
              </button>
            </div>
          </div>

          <div className="rounded-xl bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-ink-900">Workshop Actions</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {WORKSHOP_ACTIONS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  disabled={isCompleted}
                  className="flex h-20 flex-col items-center justify-center rounded-xl border-2 border-amber-200 bg-amber-50 text-center text-sm font-semibold text-amber-700 active:scale-95 active:bg-amber-100 disabled:opacity-40"
                  onClick={() => tapItem(item.key, item.label, 'WORKSHOP')}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Full-screen signature canvas */}
      {showSignatureCanvas && (
        <div className="fixed inset-0 z-[70] flex flex-col bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h2 className="text-base font-semibold text-ink-900">Customer Signature</h2>
            <button type="button" className="text-slate-400 hover:text-ink-800" onClick={() => setShowSignatureCanvas(false)}>
              ✕
            </button>
          </div>
          <div className="flex-1 p-4">
            <SignaturePad onChange={setPendingSignature} />
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-slate-200 p-4">
            <button type="button" className="btn-secondary" onClick={() => setPendingSignature(null)}>
              Clear Canvas
            </button>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary" onClick={() => setShowSignatureCanvas(false)}>
                Cancel
              </button>
              <button type="button" className="btn-primary" disabled={!pendingSignature} onClick={acceptSignature}>
                Accept &amp; Save Signature
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmingDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-ink-900">Delete this work order?</h2>
            <p className="text-sm text-slate-600">This moves {workOrder.woNumber} to the Recycle Bin. This cannot be undone from here.</p>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setConfirmingDelete(false)} disabled={deleting}>
                Cancel
              </button>
              <button type="button" className="btn-danger" onClick={deleteWorkOrder} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
