import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { computeVatFigures, computeNet, dueDateFor } from '@/lib/vat';
import { z } from 'zod';

const Schema = z.object({ periodStart: z.string(), periodEnd: z.string() });

// Prepare (or reopen) the VAT return for a period.
export async function POST(req: NextRequest) {
  const { error } = await requireRole('ADMIN');
  if (error) return error;
  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'periodStart and periodEnd required' }, { status: 400 });
  const start = new Date(parsed.data.periodStart);
  const end = new Date(parsed.data.periodEnd);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return NextResponse.json({ error: 'Invalid period' }, { status: 400 });

  const existing = await prisma.vatReturn.findFirst({ where: { periodStart: start, periodEnd: end } });
  if (existing) return NextResponse.json(existing);

  const [figures, settings] = await Promise.all([computeVatFigures(start, end), prisma.appSettings.findUnique({ where: { id: 1 } })]);
  const created = await prisma.vatReturn.create({
    data: {
      periodStart: start,
      periodEnd: end,
      dueDate: dueDateFor(end, settings?.vatDueDay ?? 21),
      outputTax: figures.outputTax,
      inputTax: figures.inputTax,
      taxableSales: figures.taxableSales,
      totalSales: figures.totalSales,
      netPayable: computeNet({ outputTax: figures.outputTax, inputTax: figures.inputTax, outputAdjustment: 0, inputAdjustment: 0 }),
    },
  });
  return NextResponse.json(created, { status: 201 });
}
