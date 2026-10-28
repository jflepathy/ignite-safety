import { prisma } from '@/lib/prisma';
import { addMonths, endOfMonth, startOfMonth } from 'date-fns';

const r2 = (n: number) => Math.round(n * 100) / 100;
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));

export type VatFigures = {
  totalSales: number; // net of VAT, invoices + receipts - credit notes
  taxableSales: number; // part of that on lines carrying a VAT rate
  outputTax: number;
  inputTax: number;
  purchases: number; // net of VAT
  invoiceCount: number;
  receiptCount: number;
  creditNoteCount: number;
  billCount: number;
};

/** VAT figures for a period, from live invoices, receipts, credit notes and bills (accrual basis, by document date). */
export async function computeVatFigures(start: Date, end: Date): Promise<VatFigures> {
  const from = utc(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const to = new Date(utc(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()).getTime() + 86400000 - 1);
  const [invoices, receipts, creditNotes, bills] = await Promise.all([
    prisma.invoice.findMany({
      where: { deletedAt: null, status: { notIn: ['DRAFT', 'VOID'] }, issueDate: { gte: from, lte: to } },
      select: { total: true, taxTotal: true, taxInclusive: true, lineItems: { select: { lineTotal: true, taxRate: { select: { ratePercent: true } } } } },
    }),
    prisma.salesReceipt.findMany({
      where: { saleDate: { gte: from, lte: to } },
      select: { total: true, taxTotal: true, lineItems: { select: { lineTotal: true, taxRate: { select: { ratePercent: true } } } } },
    }),
    prisma.creditNote.findMany({
      where: { status: { in: ['ISSUED', 'APPLIED'] }, issueDate: { gte: from, lte: to } },
      select: { total: true, taxTotal: true },
    }),
    prisma.bill.findMany({
      where: { billDate: { gte: from, lte: to } },
      select: { total: true, taxTotal: true },
    }),
  ]);

  let totalSales = 0, taxableSales = 0, outputTax = 0;
  const addDoc = (d: { total: any; taxTotal: any; lineItems: { lineTotal: any; taxRate: { ratePercent: any } | null }[] }) => {
    totalSales += Number(d.total) - Number(d.taxTotal);
    outputTax += Number(d.taxTotal);
    for (const li of d.lineItems) {
      const rate = li.taxRate ? Number(li.taxRate.ratePercent) : 0;
      if (rate > 0) taxableSales += Number(li.lineTotal) / (1 + rate / 100); // lineTotal is tax-inclusive
    }
  };
  invoices.forEach(addDoc);
  receipts.forEach(addDoc);
  for (const cn of creditNotes) {
    totalSales -= Number(cn.total) - Number(cn.taxTotal);
    outputTax -= Number(cn.taxTotal);
  }
  let inputTax = 0, purchases = 0;
  for (const b of bills) {
    inputTax += Number(b.taxTotal);
    purchases += Number(b.total) - Number(b.taxTotal);
  }
  return {
    totalSales: r2(totalSales),
    taxableSales: r2(taxableSales),
    outputTax: r2(outputTax),
    inputTax: r2(inputTax),
    purchases: r2(purchases),
    invoiceCount: invoices.length,
    receiptCount: receipts.length,
    creditNoteCount: creditNotes.length,
    billCount: bills.length,
  };
}

export type Period = { start: Date; end: Date; label: string; due: Date };

export function dueDateFor(periodEnd: Date, dueDay: number): Date {
  const next = addMonths(startOfMonth(periodEnd), 1);
  const lastDay = endOfMonth(next).getDate();
  return utc(next.getFullYear(), next.getMonth(), Math.min(Math.max(1, dueDay), lastDay));
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function periodLabel(start: Date, end: Date): string {
  const sm = start.getUTCMonth(), em = end.getUTCMonth(), y = end.getUTCFullYear();
  if (sm === em && start.getUTCFullYear() === y) return `${MONTHS[sm]} ${y}`;
  if (end.getUTCFullYear() === start.getUTCFullYear() && em - sm === 2 && sm % 3 === 0) return `Q${sm / 3 + 1} ${y}`;
  return `${MONTHS[sm]} - ${MONTHS[em]} ${y}`;
}

/** Calendar of filing periods around today: the last `back` periods and the next `ahead`. */
export function filingPeriods(frequency: string, dueDay: number, today = new Date(), back = 6, ahead = 2): Period[] {
  const step = frequency === 'QUARTERLY' ? 3 : 1;
  const y = today.getUTCFullYear(), m = today.getUTCMonth();
  const curStartMonth = step === 3 ? Math.floor(m / 3) * 3 : m;
  const out: Period[] = [];
  for (let i = -back; i <= ahead; i++) {
    const sm = curStartMonth + i * step;
    const start = utc(y, sm, 1);
    const end = utc(y, sm + step, 0);
    out.push({ start, end, label: periodLabel(start, end), due: dueDateFor(end, dueDay) });
  }
  return out;
}

export function computeNet(f: { outputTax: number; inputTax: number; outputAdjustment: number; inputAdjustment: number }) {
  return r2(f.outputTax + f.outputAdjustment - (f.inputTax + f.inputAdjustment));
}
