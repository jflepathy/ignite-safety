import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';

const COLUMNS = ['sku', 'name', 'description', 'category', 'itemType', 'unitPrice', 'cost', 'taxable', 'quantityOnHand', 'reorderPoint', 'active'] as const;

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  const { error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;
  const items = await prisma.shopItem.findMany({ orderBy: { sku: 'asc' } });

  const lines = [COLUMNS.join(',')];
  for (const item of items) {
    lines.push(COLUMNS.map((c) => csvEscape((item as any)[c]?.toString?.() ?? (item as any)[c])).join(','));
  }

  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="products-services-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
