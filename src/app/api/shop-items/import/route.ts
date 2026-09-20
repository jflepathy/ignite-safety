import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { parseCsv } from '@/lib/csv';

const VALID_TYPES = ['INVENTORY', 'NON_INVENTORY', 'SERVICE', 'BUNDLE'];

export async function POST(req: NextRequest) {
  const { error } = await requireRole('ADMIN');
  if (error) return error;

  const text = await req.text();
  const rows = parseCsv(text);
  if (rows.length === 0) {
    return NextResponse.json({ error: 'No rows found. Expected a header row with at least sku,name,unitPrice.' }, { status: 400 });
  }

  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const [i, row] of rows.entries()) {
    const sku = row.sku?.trim();
    const name = row.name?.trim();
    const unitPrice = parseFloat(row.unitPrice);
    if (!sku || !name || Number.isNaN(unitPrice)) {
      errors.push(`Row ${i + 2}: sku, name and unitPrice are required.`);
      continue;
    }
    const itemType = VALID_TYPES.includes((row.itemType ?? '').toUpperCase()) ? row.itemType.toUpperCase() : 'NON_INVENTORY';
    const data = {
      sku,
      name,
      description: row.description || undefined,
      category: row.category || undefined,
      itemType: itemType as any,
      unitPrice,
      cost: row.cost ? parseFloat(row.cost) : undefined,
      taxable: row.taxable ? ['true', '1', 'yes'].includes(row.taxable.toLowerCase()) : true,
      quantityOnHand: itemType === 'INVENTORY' && row.quantityOnHand ? parseInt(row.quantityOnHand, 10) : undefined,
      reorderPoint: itemType === 'INVENTORY' && row.reorderPoint ? parseInt(row.reorderPoint, 10) : undefined,
      active: row.active ? ['true', '1', 'yes'].includes(row.active.toLowerCase()) : true,
    };

    try {
      // eslint-disable-next-line no-await-in-loop
      const existing = await prisma.shopItem.findUnique({ where: { sku } });
      if (existing) {
        // eslint-disable-next-line no-await-in-loop
        await prisma.shopItem.update({ where: { sku }, data });
        updated += 1;
      } else {
        // eslint-disable-next-line no-await-in-loop
        await prisma.shopItem.create({ data });
        created += 1;
      }
    } catch (e: any) {
      errors.push(`Row ${i + 2} (${sku}): ${e.message}`);
    }
  }

  return NextResponse.json({ created, updated, errors });
}
