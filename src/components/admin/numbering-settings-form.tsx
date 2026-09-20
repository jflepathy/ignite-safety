'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Settings = {
  invoicePrefix: string;
  estimatePrefix: string;
  creditNotePrefix: string;
  workOrderPrefix: string;
  serviceRequestPrefix: string;
  salesOrderPrefix: string;
  salesReceiptPrefix: string;
  refundReceiptPrefix: string;
  billPrefix: string;
  purchaseOrderPrefix: string;
  supplierCreditPrefix: string;
  journalEntryPrefix: string;
};

const FIELDS: { key: keyof Settings; label: string }[] = [
  { key: 'invoicePrefix', label: 'Invoice' },
  { key: 'estimatePrefix', label: 'Estimate' },
  { key: 'creditNotePrefix', label: 'Credit Note' },
  { key: 'salesOrderPrefix', label: 'Sales Order' },
  { key: 'salesReceiptPrefix', label: 'Sales Receipt' },
  { key: 'refundReceiptPrefix', label: 'Refund Receipt' },
  { key: 'workOrderPrefix', label: 'Work Order' },
  { key: 'serviceRequestPrefix', label: 'Service Request' },
  { key: 'billPrefix', label: 'Bill' },
  { key: 'purchaseOrderPrefix', label: 'Purchase Order' },
  { key: 'supplierCreditPrefix', label: 'Supplier Credit' },
  { key: 'journalEntryPrefix', label: 'Journal Entry' },
];

export default function NumberingSettingsForm({ settings }: { settings: Settings }) {
  const router = useRouter();
  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="card space-y-4 p-6">
      <h2 className="text-sm font-semibold text-ink-900">Document Numbering</h2>
      <p className="text-sm text-slate-500">
        Prefixes used for auto-generated document numbers (e.g. INV-2026-0001). Sequence counters advance automatically and aren&apos;t
        editable here.
      </p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label className="label">{f.label}</label>
            <input className="input" value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={saving} onClick={save}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
        {saved && <span className="text-sm text-emerald-600">Saved ✓</span>}
      </div>
    </div>
  );
}
