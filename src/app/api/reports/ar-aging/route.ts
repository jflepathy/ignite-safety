import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { differenceInCalendarDays } from 'date-fns';

export async function GET() {
  const { error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;

  const invoices = await prisma.invoice.findMany({
    where: { deletedAt: null, status: { in: ['SENT', 'PARTIAL', 'OVERDUE'] }, balanceDue: { gt: 0 } },
    include: { customer: true },
  });

  const today = new Date();
  const buckets = {
    current: [] as any[],
    d1_30: [] as any[],
    d31_60: [] as any[],
    d61_90: [] as any[],
    d90_plus: [] as any[],
  };

  for (const inv of invoices) {
    const dueDate = inv.dueDate ?? inv.issueDate;
    const daysPastDue = differenceInCalendarDays(today, dueDate);
    const row = {
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      customerName: inv.customer.displayName,
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      balanceDue: Number(inv.balanceDue),
      daysPastDue,
    };
    if (daysPastDue <= 0) buckets.current.push(row);
    else if (daysPastDue <= 30) buckets.d1_30.push(row);
    else if (daysPastDue <= 60) buckets.d31_60.push(row);
    else if (daysPastDue <= 90) buckets.d61_90.push(row);
    else buckets.d90_plus.push(row);
  }

  const sum = (rows: any[]) => rows.reduce((s, r) => s + r.balanceDue, 0);

  return NextResponse.json({
    buckets,
    totals: {
      current: sum(buckets.current),
      d1_30: sum(buckets.d1_30),
      d31_60: sum(buckets.d31_60),
      d61_90: sum(buckets.d61_90),
      d90_plus: sum(buckets.d90_plus),
      grandTotal: sum(Object.values(buckets).flat()),
    },
  });
}
