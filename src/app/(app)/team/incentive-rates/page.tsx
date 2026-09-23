import { prisma } from '@/lib/prisma';
import { formatMoney } from '@/lib/money';
import QuickAddButton from '@/components/shared/quick-add-button';
import QuickEditButton from '@/components/shared/quick-edit-button';

export default async function IncentiveRatesPage() {
  const [rates, shopItems, settings, bankAccounts] = await Promise.all([
    prisma.incentiveRate.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { shopItem: true, bundledShopItem: true },
    }),
    prisma.shopItem.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
    prisma.bankAccount.findMany({ orderBy: { name: 'asc' } }),
  ]);

  const currency = settings?.currencyCode ?? 'SCR';
  const defaultFraction = settings?.defaultIncentiveFraction ? Number(settings.defaultIncentiveFraction) : 0.2;

  const shopItemOptions = [
    { value: '', label: '— Not mapped to a catalog item —' },
    ...shopItems.map((s) => ({ value: s.id, label: `${s.sku} — ${s.name} (${formatMoney(s.unitPrice.toString(), currency)})` })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Incentive Rates</h1>
          <p className="text-sm text-slate-500">
            What each service is billed at and how much of that a technician earns. Drives the technician Incentive
            tab and the auto-populated draft invoice when a completed Work Order is converted.
          </p>
        </div>
      </div>

      <div className="card space-y-3 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-ink-900">Program defaults</h2>
            <p className="mt-1 text-sm text-slate-500">
              Default share: <span className="font-medium text-ink-900">{(defaultFraction * 100).toFixed(1)}%</span> of a
              service's price, applied to any rate below that doesn't set its own override.
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Technician cash/cheque/transfer collections deposit into:{' '}
              <span className="font-medium text-ink-900">
                {bankAccounts.find((b) => b.id === settings?.technicianCollectionsBankAccountId)?.name ?? 'Not set — technician payment collection is blocked until this is configured'}
              </span>
            </p>
          </div>
          <QuickEditButton
            title="Edit Program Defaults"
            apiUrl="/api/settings"
            label="Edit Defaults"
            buttonClassName="btn-secondary text-sm"
            initialValues={{
              defaultIncentiveFraction: defaultFraction,
              technicianCollectionsBankAccountId: settings?.technicianCollectionsBankAccountId ?? '',
            }}
            fields={[
              { key: 'defaultIncentiveFraction', label: 'Default incentive fraction (e.g. 0.2 = 1/5)', type: 'number', step: '0.01' },
              {
                key: 'technicianCollectionsBankAccountId',
                label: 'Technician collections bank account',
                type: 'select',
                options: [{ value: '', label: '— None selected —' }, ...bankAccounts.map((b) => ({ value: b.id, label: b.name }))],
              },
            ]}
          />
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Service</th>
              <th className="px-4 py-3">Catalog Item</th>
              <th className="px-4 py-3 text-right">Price</th>
              <th className="px-4 py-3">Incentive</th>
              <th className="px-4 py-3">Bundled Add-on</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rates.map((r) => {
              const effectiveFraction = r.fractionOverride != null ? Number(r.fractionOverride) : defaultFraction;
              return (
                <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-ink-900">
                    {r.label}
                    <span className="block text-xs text-slate-400">key: {r.key}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {r.shopItem ? `${r.shopItem.sku} — ${r.shopItem.name}` : <span className="text-amber-600">Unmapped — needs a catalog item</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-500">{r.shopItem ? formatMoney(r.shopItem.unitPrice.toString(), currency) : '—'}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {r.flatAmount != null
                      ? `${formatMoney(r.flatAmount.toString(), currency)} flat / unit`
                      : `${(effectiveFraction * 100).toFixed(1)}%${r.fractionOverride == null ? ' (default)' : ''}`}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {r.bundledShopItem ? `${r.bundledQuantityPerUnit}× ${r.bundledShopItem.name}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{r.active ? 'Active' : 'Inactive'}</td>
                  <td className="px-4 py-3 text-right">
                    <QuickEditButton
                      title={`Edit ${r.label}`}
                      apiUrl={`/api/incentive-rates/${r.id}`}
                      initialValues={{
                        label: r.label,
                        shopItemId: r.shopItemId ?? '',
                        fractionOverride: r.fractionOverride != null ? Number(r.fractionOverride) : '',
                        flatAmount: r.flatAmount != null ? Number(r.flatAmount) : '',
                        bundledShopItemId: r.bundledShopItemId ?? '',
                        bundledQuantityPerUnit: Number(r.bundledQuantityPerUnit),
                        active: r.active,
                      }}
                      fields={[
                        { key: 'label', label: 'Label', required: true },
                        { key: 'shopItemId', label: 'Catalog item (price billed to customer)', type: 'select', options: shopItemOptions },
                        { key: 'fractionOverride', label: 'Incentive fraction override (blank = use default)', type: 'number', step: '0.01' },
                        { key: 'flatAmount', label: `Flat incentive per unit (${currency}) — overrides fraction entirely`, type: 'number', step: '0.01' },
                        { key: 'bundledShopItemId', label: 'Auto-bundle this catalog item', type: 'select', options: shopItemOptions },
                        { key: 'bundledQuantityPerUnit', label: 'Bundled quantity per unit serviced', type: 'number', step: '1' },
                        { key: 'active', label: 'Active', type: 'checkbox' },
                      ]}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="card space-y-3 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-ink-900">New catalog item</h2>
            <p className="mt-1 text-sm text-slate-500">
              For a service not priced yet (e.g. Suppression, Valve Change) or a technician's custom line that keeps
              coming up — add it to the catalog here, then edit the matching row above to link it.
            </p>
          </div>
          <QuickAddButton
            label="+ New Catalog Item"
            title="New Catalog Item"
            apiUrl="/api/shop-items"
            fields={[
              { key: 'sku', label: 'SKU', required: true },
              { key: 'name', label: 'Name', required: true },
              { key: 'unitPrice', label: `Price (${currency})`, type: 'number', step: '0.01', required: true },
              { key: 'itemType', label: 'Type', type: 'select', options: [{ value: 'SERVICE', label: 'Service' }, { value: 'NON_INVENTORY', label: 'Non-Inventory' }], defaultValue: 'SERVICE' },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
