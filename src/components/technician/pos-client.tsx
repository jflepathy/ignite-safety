'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import SignaturePad from './signature-pad';
import BillingBridgeModal from './billing-bridge-modal';
import { formatDate } from '@/lib/format-date';

type ServiceLine = { key: string; label: string; quantity: number; kind: 'STANDARD' | 'CUSTOM' | 'WORKSHOP' };

type WorkOrder = {
  id: string;
  woNumber: string;
  status: string;
  serviceType: string;
  customerName: string;
  customerAddress: string | null;
  contactPerson: string | null;
  phone: string | null;
  locationDetails: string | null;
  scheduledDate: string | null;
  technicianNotes: string | null;
  serviceLines: ServiceLine[];
  invoiceNumberIfIssued: string | null;
  invoiceId: string | null;
  customerSignedName: string | null;
  customerSignatureDataUrl: string | null;
};

type CompanySettings = {
  companyName: string;
  companyAddress: string | null;
  companyPhone: string | null;
  logoUrl: string | null;
  /** Admin-only toggle (Session 12) — when false, a technician can
   * Complete & Sync without a customer name/signature. */
  requireCustomerSignoff: boolean;
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
  // Not a service performed on the spot -- flags that an extinguisher is
  // being taken off-site to the workshop instead of serviced here, so the
  // office can see it on the job and follow up (Session 18).
  { key: 'fext_workshop', label: 'Send F/Ext to Workshop' },
];

export default function PosClient({
  workOrder,
  settings,
  backHref = '/technician',
  claimForTechnicianId,
  isAdminPreview = false,
}: {
  workOrder: WorkOrder;
  settings: CompanySettings;
  backHref?: string;
  /** Set when this job is currently unassigned and the viewer is a
   * technician — the first save claims it for them so it drops off other
   * technicians' open-jobs list (Session 11). */
  claimForTechnicianId?: string;
  /** Admin previewing this job's POS screen can freely add AND remove
   * items; a technician can only add to / increase what's already been
   * saved — see `baselineLines` below (Session 12). */
  isAdminPreview?: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(workOrder.status);
  const [lines, setLines] = useState<ServiceLine[]>(workOrder.serviceLines ?? []);
  // The last-saved cart, used as a floor a technician can't go below —
  // they can add new items and increase quantities freely, but can't
  // remove or reduce anything already recorded (Session 12). Admin
  // preview ignores this entirely.
  const [baselineLines, setBaselineLines] = useState<ServiceLine[]>(workOrder.serviceLines ?? []);
  const [customLabel, setCustomLabel] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState(workOrder.invoiceNumberIfIssued ?? '');
  const [technicianNotes, setTechnicianNotes] = useState(workOrder.technicianNotes ?? '');
  const [signedName, setSignedName] = useState(workOrder.customerSignedName ?? '');
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(workOrder.customerSignatureDataUrl);
  const [showSignatureCanvas, setShowSignatureCanvas] = useState(false);
  const [pendingSignature, setPendingSignature] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [savingProgress, setSavingProgress] = useState(false);
  const [progressSavedAt, setProgressSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Shown right after a successful Complete & Sync (Session 16) — only for
  // a technician (not admin preview) and only when this job isn't already
  // billed, so re-opening a completed job doesn't re-prompt every time.
  const [showBillingBridge, setShowBillingBridge] = useState(false);
  // Claiming is now a deliberate, explicit step (Session 12) rather than
  // something that happened silently on the first autosave — a job that's
  // unassigned or gone stale is claimed with its own button before the
  // rest of the POS screen unlocks.
  const [claimed, setClaimed] = useState(!claimForTechnicianId);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState('');
  const [confirmingClaim, setConfirmingClaim] = useState(false);

  const totalUnitsAffected = lines.reduce((s, l) => s + l.quantity, 0);
  const isCompleted = status === 'COMPLETED';

  async function claimJob() {
    if (!claimForTechnicianId) return;
    setClaiming(true);
    setClaimError('');
    try {
      const res = await fetch(`/api/work-orders/${workOrder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedTechnicianId: claimForTechnicianId, status: 'IN_PROGRESS' }),
      });
      if (!res.ok) throw new Error('Could not claim this job — it may have just been claimed by someone else.');
      setClaimed(true);
      setStatus('IN_PROGRESS');
      setConfirmingClaim(false);
    } catch (e: any) {
      setClaimError(e.message);
    } finally {
      setClaiming(false);
    }
  }

  // A technician can be on a job across multiple visits — nothing here
  // requires "Complete & Sync" to persist. Every field (cart, notes,
  // invoice #, sign-off) saves as progress via this one function, called
  // both automatically (debounced, below) and from the explicit "Save
  // Progress" button so the technician always has a clear save point they
  // can walk away from and come back to (Session 11).
  async function saveProgress() {
    setSavingProgress(true);
    setError('');
    try {
      const res = await fetch(`/api/work-orders/${workOrder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceLines: lines,
          technicianNotes,
          invoiceNumberIfIssued: invoiceNumber,
          customerSignedName: signedName || undefined,
          customerSignatureDataUrl: signatureDataUrl || undefined,
          status: status === 'PENDING' || status === 'SCHEDULED' ? 'IN_PROGRESS' : undefined,
        }),
      });
      if (!res.ok) throw new Error('Could not save — check your connection and try again.');
      if (status === 'PENDING' || status === 'SCHEDULED') setStatus('IN_PROGRESS');
      setProgressSavedAt(new Date());
      // Whatever just got saved becomes the new floor — a technician can
      // keep adding from here, but can't undo it (Session 12).
      setBaselineLines(lines);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSavingProgress(false);
    }
  }

  // Auto-save whenever the working fields change, so nothing is lost if the
  // technician's device loses connectivity or they close the tab mid-job.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (isCompleted || !claimed) return;
    const t = setTimeout(() => {
      saveProgress();
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, technicianNotes, invoiceNumber, signedName, signatureDataUrl]);

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

  // A technician can add items and raise quantities freely, but can't
  // drop a line below what's already been saved — only Admin (previewing)
  // can reduce or remove a committed item (Session 12).
  function floorFor(key: string): number {
    if (isAdminPreview) return 0;
    return baselineLines.find((b) => b.key === key)?.quantity ?? 0;
  }

  function adjustQty(key: string, delta: number) {
    setLines((prev) =>
      prev
        .map((l) => {
          if (l.key !== key) return l;
          const floor = delta < 0 ? floorFor(key) : 0;
          const nextQty = Math.max(0, l.quantity + delta);
          return { ...l, quantity: Math.max(nextQty, floor) };
        })
        .filter((l) => l.quantity > 0)
    );
  }

  function removeLine(key: string) {
    if (floorFor(key) > 0) return; // already saved — technicians can't remove it, only Admin can
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  function acceptSignature() {
    if (!pendingSignature) return;
    setSignatureDataUrl(pendingSignature);
    setShowSignatureCanvas(false);
  }

  async function completeAndSync() {
    // Admin can always complete without a sign-off — the toggle only
    // governs technicians (Session 12).
    if (!isAdminPreview && settings.requireCustomerSignoff && (!signedName || !signatureDataUrl)) {
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
          customerSignedName: signedName || undefined,
          customerSignatureDataUrl: signatureDataUrl || undefined,
          serviceLines: lines,
          invoiceNumberIfIssued: invoiceNumber,
          technicianNotes,
        }),
      });
      if (!res.ok) throw new Error('Failed to complete & sync this work order.');
      setStatus('COMPLETED');
      if (!isAdminPreview && !workOrder.invoiceId) setShowBillingBridge(true);
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
        router.push(backHref);
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
            {workOrder.scheduledDate ? formatDate(workOrder.scheduledDate) : 'Unscheduled'}
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
            onClick={() => router.push(backHref)}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Print-only summary — same QB-style Courier New look as Invoice /
          Sales Receipt / Estimate, but trimmed to what a work order needs:
          no pricing, no tax, no bank details (Session 11). */}
      <div className="print-area hidden print:block" id="pdf-document" style={{ fontFamily: '"Courier New", Courier, monospace' }}>
        <div className="flex items-start justify-between gap-6 border-b border-slate-200 p-8 pb-6">
          <div>
            <p className="text-lg font-bold tracking-tight">{settings.companyName}</p>
            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-500">{settings.companyAddress}</p>
            <p className="text-sm text-slate-500">{settings.companyPhone}</p>
          </div>
          {settings.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.logoUrl} alt={settings.companyName} className="h-20 object-contain" />
          )}
        </div>

        <div className="p-8 pt-6">
          <div className="mb-6 flex items-start justify-between border-b-2 border-ink-900 pb-4">
            <p className="text-3xl font-bold uppercase tracking-wide">Work Order</p>
            <div className="text-right">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">WO No.</p>
              <p className="text-lg font-bold text-brand-600">{workOrder.woNumber}</p>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="text-sm">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Customer</p>
              <p className="font-semibold text-ink-900">{workOrder.customerName}</p>
              {workOrder.customerAddress && <p className="whitespace-pre-line text-slate-500">{workOrder.customerAddress}</p>}
              {workOrder.phone && <p className="text-slate-500">{workOrder.phone}</p>}
            </div>
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 self-start text-sm sm:justify-self-end">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Date</span>
              <span className="text-right font-medium sm:text-left">
                {workOrder.scheduledDate ? formatDate(workOrder.scheduledDate) : '—'}
              </span>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Location</span>
              <span className="text-right font-medium sm:text-left">{workOrder.locationDetails ?? '—'}</span>
              {invoiceNumber && (
                <>
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Invoice No.</span>
                  <span className="text-right font-medium sm:text-left">{invoiceNumber}</span>
                </>
              )}
            </div>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-slate-800 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-2">Item / Service</th>
                <th className="py-2 text-right">Qty</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, idx) => (
                <tr key={l.key} className={idx % 2 === 1 ? 'bg-slate-50/70 print:bg-white' : undefined}>
                  <td className="py-2.5 pr-2">{l.label}</td>
                  <td className="py-2.5 text-right">{l.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-right text-sm font-bold">Total Units Affected: {totalUnitsAffected}</p>

          {technicianNotes && (
            <div className="mt-6 border-t border-slate-200 pt-4 text-sm">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Technician Notes</p>
              <p className="whitespace-pre-line text-slate-600">{technicianNotes}</p>
            </div>
          )}

          <div className="mt-8 border-t border-slate-200 pt-4 text-sm">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Customer Sign-off</p>
            {signedName && <p className="font-medium text-ink-900">{signedName}</p>}
            {signatureDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={signatureDataUrl} alt="signature" className="mt-1 h-20" />
            )}
          </div>
        </div>
      </div>

      {/* Claim gate — an unassigned or stale job must be claimed before the
          rest of the POS unlocks (Session 12). */}
      {!claimed ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center print:hidden">
          <p className="text-4xl">✋</p>
          <h2 className="text-lg font-semibold text-ink-900">
            {workOrder.status === 'PENDING' || workOrder.status === 'SCHEDULED' ? 'This job is unassigned' : 'This job has gone idle'}
          </h2>
          <p className="max-w-xs text-sm text-slate-500">
            Claim it to start working — it&apos;ll be assigned to you and marked In Progress. No one else will see it while you&apos;re on it.
          </p>
          <button type="button" className="btn-primary px-8 py-3 text-base" onClick={() => setConfirmingClaim(true)}>
            Claim This Job
          </button>
          {claimError && <p className="text-sm text-red-600">{claimError}</p>}
        </div>
      ) : (
      /* Main POS layout */
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
            {lines.map((l) => {
              const floor = floorFor(l.key);
              const locked = floor > 0; // already saved — a technician can't reduce/remove it
              return (
                <div key={l.key} className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm">
                  <div>
                    <p className="text-sm font-medium text-ink-900">
                      {l.label} {locked && <span className="text-xs font-normal text-slate-400">🔒 saved</span>}
                    </p>
                    <p className="text-xs text-slate-400">{l.kind === 'WORKSHOP' ? 'Workshop action' : l.kind === 'CUSTOM' ? 'Custom' : 'Standard'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isCompleted || (locked && l.quantity <= floor)}
                      title={locked ? 'Already saved — only Admin can reduce this' : undefined}
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
                      disabled={isCompleted || locked}
                      title={locked ? 'Already saved — only Admin can remove this' : undefined}
                      className="ml-1 text-xs text-red-600 hover:underline disabled:opacity-40"
                      onClick={() => removeLine(l.key)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-xl bg-white p-3 shadow-sm">
            <label className="label">Invoice Number (IF ISSUED)</label>
            <input
              className="input"
              value={invoiceNumber}
              disabled={isCompleted}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="e.g. INV-2026-0143"
            />
          </div>

          <div className="rounded-xl bg-white p-3 shadow-sm">
            <label className="label">Technician Notes</label>
            <textarea
              className="input min-h-20"
              value={technicianNotes}
              disabled={isCompleted}
              onChange={(e) => setTechnicianNotes(e.target.value)}
              placeholder="Anything worth noting about this job — carries over each time you come back to it."
            />
          </div>

          <div className="rounded-xl bg-white p-3 shadow-sm">
            <label className="label">
              Customer Name (for sign-off){(isAdminPreview || !settings.requireCustomerSignoff) && <span className="font-normal normal-case text-slate-400"> — optional</span>}
            </label>
            {isAdminPreview ? (
              <p className="mb-2 text-xs text-slate-400">Admin can complete without a sign-off.</p>
            ) : (
              !settings.requireCustomerSignoff && (
                <p className="mb-2 text-xs text-slate-400">Sign-off isn&apos;t required for this job (admin setting) — you can complete without it.</p>
              )
            )}
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
            <div className="space-y-2">
              <button type="button" className="btn-secondary w-full py-2.5" disabled={savingProgress} onClick={saveProgress}>
                {savingProgress ? 'Saving…' : '💾 Save Progress'}
              </button>
              <p className="text-center text-xs text-slate-400">
                {savingProgress
                  ? 'Saving…'
                  : progressSavedAt
                    ? `Saved ✓ ${progressSavedAt.toLocaleTimeString()} — safe to come back to this job later.`
                    : 'Changes save automatically as you work — no need to finish in one visit.'}
              </p>
              <button className="btn-primary w-full py-3 text-base" disabled={completing} onClick={completeAndSync}>
                {completing ? 'Syncing…' : '✓ Complete & Sync'}
              </button>
            </div>
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
      )}

      {/* Claim confirmation — makes claiming a deliberate step rather than
          a single accidental tap (Session 12). */}
      {confirmingClaim && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-ink-900">Claim {workOrder.woNumber}?</h2>
            <p className="text-sm text-slate-600">
              This assigns <strong>{workOrder.customerName}</strong>&apos;s job to you and marks it In Progress. Once claimed, other
              technicians won&apos;t see it in their job list.
            </p>
            {claimError && <p className="text-sm text-red-600">{claimError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setConfirmingClaim(false)} disabled={claiming}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={claimJob} disabled={claiming}>
                {claiming ? 'Claiming…' : 'Yes, Claim It'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-screen signature canvas */}
      {showSignatureCanvas && (
        <div className="fixed inset-0 z-[70] flex flex-col bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h2 className="text-base font-semibold text-ink-900">Customer Signature</h2>
            <button type="button" className="text-slate-400 hover:text-ink-800" onClick={() => setShowSignatureCanvas(false)}>
              ✕
            </button>
          </div>
          <div className="min-h-0 flex-1 p-4">
            <SignaturePad onChange={setPendingSignature} />
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-slate-200 p-4">
            <button type="button" className="btn-secondary" onClick={() => setShowSignatureCanvas(false)}>
              Cancel
            </button>
            <button type="button" className="btn-primary" disabled={!pendingSignature} onClick={acceptSignature}>
              Accept &amp; Save Signature
            </button>
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

      {showBillingBridge && <BillingBridgeModal workOrderId={workOrder.id} onClose={() => setShowBillingBridge(false)} />}
    </div>
  );
}
