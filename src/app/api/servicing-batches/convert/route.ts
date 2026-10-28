import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { z } from 'zod';

const Schema = z.object({ key: z.string().min(1) });

// Turns a servicing "prospect" (a client seen only in historical servicing
// records) into a real customer and links all of its batches to it. The
// batch dedupe keys keep their original prefix, so a later import can never
// recreate the batches.
export async function POST(req: NextRequest) {
  const { error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;
  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'key required' }, { status: 400 });

  const batches = await prisma.servicingBatch.findMany({
    where: { dedupeKey: { startsWith: `${parsed.data.key}|` } },
    orderBy: { serviceDate: 'desc' },
  });
  if (batches.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (batches[0].customerId) return NextResponse.json({ customerId: batches[0].customerId });

  const latest = batches[0];
  const customer = await prisma.customer.create({
    data: {
      displayName: latest.clientName,
      address: batches.find((b) => b.address)?.address ?? undefined,
      phone: batches.find((b) => b.phone)?.phone ?? undefined,
      notes: 'Added from historical servicing records.',
    },
  });
  for (const b of batches) {
    await prisma.servicingBatch.update({ where: { id: b.id }, data: { customerId: customer.id } });
  }
  return NextResponse.json({ customerId: customer.id }, { status: 201 });
}
