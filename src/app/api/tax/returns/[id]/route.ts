import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { computeVatFigures, computeNet } from '@/lib/vat';
import { z } from 'zod';

const Schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('recalculate') }),
  z.object({
    action: z.literal('save'),
    outputAdjustment: z.number(),
    inputAdjustment: z.number(),
    notes: z.string().nullable().optional(),
  }),
  z.object({ action: z.literal('file'), filedAt: z.string(), filedReference: z.string().nullable().optional() }),
  z.object({ action: z.literal('pay'), paidAt: z.string(), paidAmount: z.number(), paymentReference: z.string().nullable().optional() }),
  z.object({ action: z.literal('reopen') }),
]);

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireRole('ADMIN');
  if (error) return error;
  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const vr = await prisma.vatReturn.findUnique({ where: { id: params.id } });
  if (!vr) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const d = parsed.data;
  const locked = vr.status !== 'DRAFT';

  if (d.action === 'recalculate' || d.action === 'save') {
    if (locked) return NextResponse.json({ error: 'A filed return is locked - reopen it first.' }, { status: 400 });
    const figs = d.action === 'recalculate' ? await computeVatFigures(vr.periodStart, vr.periodEnd) : null;
    const outputTax = figs ? figs.outputTax : Number(vr.outputTax);
    const inputTax = figs ? figs.inputTax : Number(vr.inputTax);
    const outputAdjustment = d.action === 'save' ? d.outputAdjustment : Number(vr.outputAdjustment);
    const inputAdjustment = d.action === 'save' ? d.inputAdjustment : Number(vr.inputAdjustment);
    const updated = await prisma.vatReturn.update({
      where: { id: vr.id },
      data: {
        outputTax,
        inputTax,
        outputAdjustment,
        inputAdjustment,
        ...(figs ? { taxableSales: figs.taxableSales, totalSales: figs.totalSales } : {}),
        ...(d.action === 'save' ? { notes: d.notes ?? null } : {}),
        netPayable: computeNet({ outputTax, inputTax, outputAdjustment, inputAdjustment }),
      },
    });
    return NextResponse.json(updated);
  }
  if (d.action === 'file') {
    const updated = await prisma.vatReturn.update({
      where: { id: vr.id },
      data: { status: 'FILED', filedAt: new Date(d.filedAt), filedReference: d.filedReference || null },
    });
    return NextResponse.json(updated);
  }
  if (d.action === 'pay') {
    const updated = await prisma.vatReturn.update({
      where: { id: vr.id },
      data: { status: 'PAID', paidAt: new Date(d.paidAt), paidAmount: d.paidAmount, paymentReference: d.paymentReference || null, filedAt: vr.filedAt ?? new Date(d.paidAt) },
    });
    return NextResponse.json(updated);
  }
  const updated = await prisma.vatReturn.update({
    where: { id: vr.id },
    data: { status: 'DRAFT', filedAt: null, filedReference: null, paidAt: null, paidAmount: null, paymentReference: null },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireRole('ADMIN');
  if (error) return error;
  const vr = await prisma.vatReturn.findUnique({ where: { id: params.id } });
  if (!vr) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (vr.status !== 'DRAFT') return NextResponse.json({ error: 'Only draft returns can be deleted.' }, { status: 400 });
  await prisma.vatReturn.delete({ where: { id: vr.id } });
  return NextResponse.json({ ok: true });
}
