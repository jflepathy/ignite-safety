import { prisma } from '@/lib/prisma';
import { differenceInCalendarDays, startOfDay } from 'date-fns';
import { randomBytes } from 'crypto';
import { formatDate } from '@/lib/format-date';

export type StatementLine = {
  date: string; // dd/mm/yyyy
  type: 'INVOICE' | 'PAYMENT' | 'CREDIT';
  ref: string;
  description: string;
  charge: number;
  credit: number;
  balance: number;
};

export type StatementData = {
  settings: {
    companyName: string;
    companyAddress: string | null;
    companyPhone: string | null;
    companyEmail: string | null;
    taxRegistrationNumber: string | null;
    logoUrl: string | null;
    paymentInstructions: string | null;
    bankName: string | null;
    bankAccountName: string | null;
    bankAccountNumber: string | null;
  };
  currency: string;
  customer: { id: string; displayName: string; address: string | null; phone: string | null; email: string | null };
  statementDate: string;
  fromDate: string | null;
  toDate: string;
  openingBalance: number;
  lines: StatementLine[];
  closingBalance: number;
  totalCharges: number;
  totalCredits: number;
  aging: { current: number; d1_30: number; d31_60: number; d61_90: number; d90plus: number };
  openInvoices: { number: string; issueDate: string; dueDate: string | null; total: number; balance: number; daysOverdue: number }[];
};

const METHOD: Record<string, string> = { CASH: 'Cash', CARD: 'Card', BANK_TRANSFER: 'Bank transfer', CHEQUE: 'Cheque', OTHER: 'Other' };
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Make sure the customer has a public statement link token. */
export async function ensureStatementToken(customerId: string, current: string | null): Promise<string> {
  if (current) return current;
  const token = randomBytes(16).toString('hex');
  await prisma.customer.update({ where: { id: customerId }, data: { statementToken: token } });
  return token;
}

/**
 * Account statement for one customer: invoices as charges, payments and
 * credit notes as credits, running balance, plus an ageing of what is still
 * open today. `from` null = since the beginning (no opening balance).
 */
export async function buildStatement(customerId: string, opts: { from?: Date | null; to?: Date | null } = {}): Promise<StatementData | null> {
  const [customer, settings] = await Promise.all([
    prisma.customer.findUnique({ where: { id: customerId } }),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
  ]);
  if (!customer || customer.deletedAt) return null;

  const [invoices, creditNotes] = await Promise.all([
    prisma.invoice.findMany({
      where: { customerId, deletedAt: null, status: { notIn: ['DRAFT', 'VOID'] } },
      include: { payments: true },
    }),
    prisma.creditNote.findMany({ where: { customerId, status: { in: ['ISSUED', 'APPLIED'] } } }),
  ]);

  type Tx = { at: Date; type: StatementLine['type']; ref: string; description: string; charge: number; credit: number };
  const txs: Tx[] = [];
  for (const inv of invoices) {
    txs.push({
      at: inv.issueDate,
      type: 'INVOICE',
      ref: inv.invoiceNumber,
      description: inv.poNumber ? `Invoice (PO ${inv.poNumber})` : 'Invoice',
      charge: Number(inv.total),
      credit: 0,
    });
    for (const p of inv.payments) {
      if (p.verificationStatus === 'PENDING_REVIEW' || p.verificationStatus === 'MISMATCH') continue;
      txs.push({
        at: p.paidAt,
        type: 'PAYMENT',
        ref: inv.invoiceNumber,
        description: `Payment received - ${METHOD[p.method] ?? p.method}${p.reference ? ` (${p.reference})` : ''}`,
        charge: 0,
        credit: Number(p.amount),
      });
    }
  }
  for (const cn of creditNotes) {
    txs.push({ at: cn.issueDate, type: 'CREDIT', ref: cn.creditNoteNumber, description: 'Credit note', charge: 0, credit: Number(cn.total) });
  }
  const order = { INVOICE: 0, PAYMENT: 1, CREDIT: 2 } as const;
  txs.sort((a, b) => a.at.getTime() - b.at.getTime() || order[a.type] - order[b.type]);

  const from = opts.from ? startOfDay(opts.from) : null;
  const to = opts.to ? new Date(startOfDay(opts.to).getTime() + 86400000 - 1) : new Date();

  let opening = 0;
  const inRange: Tx[] = [];
  for (const t of txs) {
    if (t.at > to) continue;
    if (from && t.at < from) opening += t.charge - t.credit;
    else inRange.push(t);
  }
  opening = r2(opening);
  let bal = opening;
  let totalCharges = 0;
  let totalCredits = 0;
  const lines: StatementLine[] = inRange.map((t) => {
    bal = r2(bal + t.charge - t.credit);
    totalCharges += t.charge;
    totalCredits += t.credit;
    return { date: formatDate(t.at), type: t.type, ref: t.ref, description: t.description, charge: t.charge, credit: t.credit, balance: bal };
  });

  // Ageing: invoices still carrying a balance today.
  const today = startOfDay(new Date());
  const aging = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0 };
  const openInvoices: StatementData['openInvoices'] = [];
  for (const inv of invoices) {
    const balance = Number(inv.balanceDue);
    if (balance <= 0.004) continue;
    const ref = inv.dueDate ?? inv.issueDate;
    const over = differenceInCalendarDays(today, ref);
    if (over <= 0) aging.current += balance;
    else if (over <= 30) aging.d1_30 += balance;
    else if (over <= 60) aging.d31_60 += balance;
    else if (over <= 90) aging.d61_90 += balance;
    else aging.d90plus += balance;
    openInvoices.push({
      number: inv.invoiceNumber,
      issueDate: formatDate(inv.issueDate),
      dueDate: inv.dueDate ? formatDate(inv.dueDate) : null,
      total: Number(inv.total),
      balance,
      daysOverdue: Math.max(0, over),
    });
  }
  openInvoices.sort((a, b) => b.daysOverdue - a.daysOverdue);
  (Object.keys(aging) as (keyof typeof aging)[]).forEach((k) => (aging[k] = r2(aging[k])));

  return {
    settings: {
      companyName: settings?.companyName ?? 'Ignite Safety',
      companyAddress: settings?.companyAddress ?? null,
      companyPhone: settings?.companyPhone ?? null,
      companyEmail: settings?.companyEmail ?? null,
      taxRegistrationNumber: settings?.taxRegistrationNumber ?? null,
      logoUrl: settings?.logoUrl ?? null,
      paymentInstructions: settings?.paymentInstructions ?? null,
      bankName: settings?.bankName ?? null,
      bankAccountName: settings?.bankAccountName ?? null,
      bankAccountNumber: settings?.bankAccountNumber ?? null,
    },
    currency: settings?.currencyCode ?? 'SCR',
    customer: { id: customer.id, displayName: customer.displayName, address: customer.address, phone: customer.phone, email: customer.email },
    statementDate: formatDate(new Date()),
    fromDate: from ? formatDate(from) : null,
    toDate: formatDate(to),
    openingBalance: opening,
    lines,
    closingBalance: bal,
    totalCharges: r2(totalCharges),
    totalCredits: r2(totalCredits),
    aging,
    openInvoices,
  };
}
