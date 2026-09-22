'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import QuickEditButton from '@/components/shared/quick-edit-button';

type TaxRate = { id: string; name: string; ratePercent: number; isDefault: boolean; active: boolean };

export default function TaxRateActions({ rate }: { rate: TaxRate }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  async function remove() {
    if (!confirm(`Delete "${rate.name}"? Existing invoices that used it keep their history — this just stops it being offered on new ones.`)) return;
    setDeleting(true);
    setError('');
    try {
      const res = await fetch(`/api/tax-rates/${rate.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? 'Failed to delete');
      }
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex items-center justify-end gap-3">
      {error && <span className="text-xs text-red-600">{error}</span>}
      <QuickEditButton
        title={`Edit ${rate.name}`}
        apiUrl={`/api/tax-rates/${rate.id}`}
        initialValues={{ name: rate.name, ratePercent: Number(rate.ratePercent), isDefault: rate.isDefault, active: rate.active }}
        fields={[
          { key: 'name', label: 'Name', required: true },
          { key: 'ratePercent', label: 'Rate (%)', type: 'number', step: '0.01', required: true },
          { key: 'isDefault', label: 'Default rate', type: 'checkbox' },
          { key: 'active', label: 'Active (offered on new documents)', type: 'checkbox' },
        ]}
      />
      {rate.active && !rate.isDefault && (
        <button className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50" disabled={deleting} onClick={remove}>
          {deleting ? 'Deleting…' : 'Delete'}
        </button>
      )}
    </div>
  );
}
