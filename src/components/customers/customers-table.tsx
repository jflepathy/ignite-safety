'use client';

import { useState } from 'react';
import QuickEditButton from '@/components/shared/quick-edit-button';

type Customer = {
  id: string;
  displayName: string;
  type: string;
  contactPerson: string | null;
  phone: string | null;
  altPhone: string | null;
  email: string | null;
  address: string | null;
  region: string | null;
  district: string | null;
  taxId: string | null;
  terms: string | null;
  notes: string | null;
  _count: { equipment: number; invoices: number; workOrders: number };
};

export const REGION_OPTIONS = ['Mahe', 'Praslin', 'La Digue', 'Outer Islands'];

// Matches InvoiceForm's TERMS_PRESETS (minus "Custom", which doesn't make
// sense as a stored per-customer default) -- keeps a customer's saved
// Terms directly selectable as an Invoice preset with no extra matching.
export const CUSTOMER_TERMS_OPTIONS = ['Due on Receipt', 'Net 15', 'Net 30', 'Net 60'];

// The official 26 administrative districts of Seychelles, grouped by region
// (per Wikipedia's "Districts of Seychelles" — the 14 Mahe-island districts
// plus the 8 Greater Victoria districts are both part of Mahe island, so
// both roll up under the "Mahe" region option). Used for the customer
// form's District dropdown and to auto-match existing customer addresses
// (Session 11).
export const DISTRICTS_BY_REGION: Record<string, string[]> = {
  Mahe: [
    'Anse aux Pins', 'Anse Boileau', 'Anse Etoile', 'Au Cap', 'Anse Royale',
    'Baie Lazare', 'Beau Vallon', 'Bel Ombre', 'Cascade', 'Glacis',
    "Grand'Anse Mahe", 'Pointe La Rue', 'Port Glaud', 'Takamaka',
    'Bel Air', 'English River', 'Mont Buxton', 'Mont Fleuri', 'Plaisance',
    'Saint Louis', 'Les Mamelles', 'Roche Caiman',
  ],
  Praslin: ['Baie Sainte Anne', "Grand'Anse Praslin"],
  'La Digue': ['La Digue and Inner Islands'],
  'Outer Islands': ['Outer Islands'],
};

export default function CustomersTable({ customers, canEdit }: { customers: Customer[]; canEdit: boolean }) {
  const [query, setQuery] = useState('');

  const filtered = customers.filter((c) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      c.displayName.toLowerCase().includes(q) ||
      (c.phone ?? '').toLowerCase().includes(q) ||
      (c.region ?? '').toLowerCase().includes(q) ||
      (c.district ?? '').toLowerCase().includes(q) ||
      (c.email ?? '').toLowerCase().includes(q)
    );
  });

  const districtOptions = Object.values(DISTRICTS_BY_REGION).flat();

  return (
    <div className="space-y-3">
      <input
        className="input max-w-sm"
        placeholder="Search by name, phone, email, region or district…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Region</th>
              <th className="px-4 py-3">District</th>
              <th className="px-4 py-3">Equipment</th>
              <th className="px-4 py-3">Work Orders</th>
              <th className="px-4 py-3">Invoices</th>
              {canEdit && <th className="px-4 py-3"></th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-ink-900">{c.displayName}</td>
                <td className="px-4 py-3 text-slate-500">{c.phone ?? '—'}</td>
                <td className="px-4 py-3 text-slate-500">{c.region ?? '—'}</td>
                <td className="px-4 py-3 text-slate-500">{c.district ?? '—'}</td>
                <td className="px-4 py-3">{c._count.equipment}</td>
                <td className="px-4 py-3">{c._count.workOrders}</td>
                <td className="px-4 py-3">{c._count.invoices}</td>
                {canEdit && (
                  <td className="px-4 py-3 text-right">
                    <QuickEditButton
                      title={`Edit ${c.displayName}`}
                      apiUrl={`/api/customers/${c.id}`}
                      initialValues={{
                        displayName: c.displayName,
                        type: c.type,
                        contactPerson: c.contactPerson ?? '',
                        phone: c.phone ?? '',
                        altPhone: c.altPhone ?? '',
                        email: c.email ?? '',
                        address: c.address ?? '',
                        region: c.region ?? '',
                        district: c.district ?? '',
                        taxId: c.taxId ?? '',
                        terms: c.terms ?? '',
                        notes: c.notes ?? '',
                      }}
                      fields={[
                        { key: 'displayName', label: 'Name', required: true },
                        {
                          key: 'type',
                          label: 'Type',
                          type: 'select',
                          options: [
                            { value: 'COMPANY', label: 'Company' },
                            { value: 'INDIVIDUAL', label: 'Individual' },
                            { value: 'GOVERNMENT', label: 'Government' },
                          ],
                        },
                        { key: 'contactPerson', label: 'Contact Person' },
                        { key: 'phone', label: 'Phone' },
                        { key: 'altPhone', label: 'Alt. Phone' },
                        { key: 'email', label: 'Email' },
                        { key: 'address', label: 'Address' },
                        {
                          key: 'region',
                          label: 'Region',
                          type: 'select',
                          options: [{ value: '', label: '— Select —' }, ...REGION_OPTIONS.map((r) => ({ value: r, label: r }))],
                        },
                        {
                          key: 'district',
                          label: 'District',
                          type: 'select',
                          options: [{ value: '', label: '— Select —' }, ...districtOptions.map((d) => ({ value: d, label: d }))],
                        },
                        { key: 'taxId', label: 'Tax / VAT ID' },
                        {
                          key: 'terms',
                          label: 'Default Invoice Terms',
                          type: 'select',
                          options: [
                            { value: '', label: '— Use company default —' },
                            ...CUSTOMER_TERMS_OPTIONS.map((t) => ({ value: t, label: t })),
                          ],
                        },
                        { key: 'notes', label: 'Notes', type: 'textarea' },
                      ]}
                    />
                  </td>
                )}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={canEdit ? 8 : 7} className="px-4 py-10 text-center text-slate-400">
                  {customers.length === 0 ? 'No customers yet.' : 'No customers match your search.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
