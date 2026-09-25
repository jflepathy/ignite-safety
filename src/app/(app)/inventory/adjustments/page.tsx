import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { formatDate } from '@/lib/format-date';

export default async function InventoryAdjustmentsPage() {
  const adjustments = await prisma.inventoryAdjustment.findMany({
    include: { shopItem: true },
    orderBy: { date: 'desc' },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Inventory Adjustments</h1>
          <p className="text-sm text-slate-500">Manual stock corrections — receiving, shrinkage, counts.</p>
        </div>
        <Link href="/inventory/adjustments/new" className="btn-primary">
          + New Adjustment
        </Link>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3 text-right">Change</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">Memo</th>
            </tr>
          </thead>
          <tbody>
            {adjustments.map((a) => (
              <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-500">{formatDate(a.date)}</td>
                <td className="px-4 py-3 font-medium text-ink-900">{a.shopItem.name}</td>
                <td className={`px-4 py-3 text-right font-medium ${a.quantityChange < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {a.quantityChange > 0 ? `+${a.quantityChange}` : a.quantityChange}
                </td>
                <td className="px-4 py-3 text-slate-500">{a.reason ?? '—'}</td>
                <td className="px-4 py-3 text-slate-500">{a.memo ?? '—'}</td>
              </tr>
            ))}
            {adjustments.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                  No adjustments recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
