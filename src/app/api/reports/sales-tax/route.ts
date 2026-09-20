import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  const { error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;

  const from = req.nextUrl.searchParams.get('from');
  const to = req.nextUrl.searchParams.get('to');

  const invoices = await prisma.invoice.findMany({
    where: {
      deletedAt: null,
      status: { not: 'VOID' },
      ...(from || to
        ? {
            issueDate: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    },
    select: { invoiceNumber: true, issueDate: true, subtotal: true, taxTotal: true, total: true },
    orderBy: { issueDate: 'asc' },
  });

  const totalTaxCollected = invoices.reduce((s, i) => s + Number(i.taxTotal), 0);
  const totalTaxableSales = invoices.reduce((s, i) => s + Number(i.subtotal), 0);

  return NextResponse.json({
    invoices,
    totalTaxableSales,
    totalTaxCollected,
    invoiceCount: invoices.length,
  });
}
