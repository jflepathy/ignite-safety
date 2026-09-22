import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { z } from 'zod';

const Schema = z.object({
  amount: z.number().positive(),
  method: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'OTHER']),
  reference: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;
  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const bill = await prisma.bill.findUnique({ where: { id: params.id }, include: { lineItems: true } });
  if (!bill) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.supplierPayment.create({
    data: { billId: params.id, amount: parsed.data.amount, method: parsed.data.method, reference: parsed.data.reference },
  });

  const totalPaid = bill.lineItems.reduce((s, p) => s + Number(p.amount), 0) + parsed.data.amount;
  const total = Number(bill.total);
  const balanceDue = Math.max(total - totalPaid, 0);
  const status = balanceDue <= 0 ? 'PAID' : totalPaid > 0 ? 'PARTIAL' : 'OPEN';

  await prisma.bill.update({
    where: { id: params.id },
    data: { amountPaid: totalPaid, balanceDue, status },
  });
  const updated = await prisma.bill.findUnique({ where: { id: params.id }, include: { supplier: true } });

  return NextResponse.json(updated, { status: 201 });
}
