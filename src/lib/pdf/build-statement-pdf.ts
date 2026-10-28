import { jsPDF } from 'jspdf';
import { formatMoney } from '@/lib/money';
import type { StatementData } from '@/lib/statement';

const MM = 2.834645669;

/** Text-based statement PDF (works in the browser and on the server). */
export function buildStatementPdf(d: StatementData): jsPDF {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const x0 = 14 * MM;
  const x1 = W - 14 * MM;
  const bottom = H - 16 * MM;
  const m = (n: number) => formatMoney(n, d.currency);
  const ink: [number, number, number] = [15, 23, 42];
  const grey: [number, number, number] = [100, 116, 139];
  const red: [number, number, number] = [236, 47, 47];
  pdf.setFont('courier', 'normal');
  let y = 14 * MM + 10;

  // header
  pdf.setFont('courier', 'bold').setFontSize(13).setTextColor(...ink);
  pdf.text(d.settings.companyName, x0, y);
  pdf.setFont('courier', 'normal').setFontSize(9).setTextColor(...grey);
  y += 14;
  for (const line of [...(d.settings.companyAddress ?? '').split('\n'), d.settings.companyPhone ?? '', d.settings.companyEmail ?? '']) {
    if (!line.trim()) continue;
    pdf.text(line, x0, y);
    y += 11;
  }
  y += 10;
  pdf.setDrawColor(...ink).setLineWidth(1.5).line(x0, y, x1, y);
  y += 24;
  pdf.setFont('courier', 'bold').setFontSize(22).setTextColor(...ink).text('STATEMENT', x0, y);
  pdf.setFontSize(9).setTextColor(...grey).text('STATEMENT DATE', x1, y - 14, { align: 'right' });
  pdf.setFontSize(13).setTextColor(...red).text(d.statementDate, x1, y, { align: 'right' });
  y += 26;

  pdf.setFont('courier', 'bold').setFontSize(8).setTextColor(...grey).text('STATEMENT TO', x0, y);
  pdf.text('AMOUNT DUE', x1, y, { align: 'right' });
  y += 12;
  pdf.setFont('courier', 'bold').setFontSize(10.5).setTextColor(...ink).text(d.customer.displayName, x0, y);
  pdf.setFontSize(14).text(m(d.closingBalance), x1, y + 2, { align: 'right' });
  pdf.setFont('courier', 'normal').setFontSize(9).setTextColor(...grey);
  let ya = y + 11;
  for (const line of [...(d.customer.address ?? '').split('\n'), d.customer.phone ?? '']) {
    if (!line.trim()) continue;
    pdf.text(line, x0, ya);
    ya += 11;
  }
  pdf.text(d.fromDate ? `${d.fromDate} - ${d.toDate}` : `To ${d.toDate}`, x1, y + 16, { align: 'right' });
  y = Math.max(ya, y + 24) + 12;

  const cols = { date: x0, ref: x0 + 58, desc: x0 + 128, chg: x1 - 150, pay: x1 - 78, bal: x1 };
  const head = () => {
    pdf.setFont('courier', 'bold').setFontSize(8).setTextColor(...grey);
    pdf.text('DATE', cols.date, y);
    pdf.text('REF', cols.ref, y);
    pdf.text('DESCRIPTION', cols.desc, y);
    pdf.text('CHARGES', cols.chg, y, { align: 'right' });
    pdf.text('PAYMENTS', cols.pay, y, { align: 'right' });
    pdf.text('BALANCE', cols.bal, y, { align: 'right' });
    y += 4;
    pdf.setDrawColor(...ink).setLineWidth(1).line(x0, y, x1, y);
    y += 12;
  };
  const room = (n: number) => {
    if (y + n > bottom) {
      pdf.addPage();
      y = 14 * MM + 10;
      head();
    }
  };
  head();
  const row = (date: string, ref: string, desc: string, chg: string, pay: string, bal: string, italic = false) => {
    room(14);
    pdf.setFont('courier', italic ? 'italic' : 'normal').setFontSize(8.5).setTextColor(...ink);
    pdf.text(date, cols.date, y);
    pdf.text(ref, cols.ref, y);
    pdf.text(desc.length > 30 ? desc.slice(0, 29) + '…' : desc, cols.desc, y);
    if (chg) pdf.text(chg, cols.chg, y, { align: 'right' });
    if (pay) pdf.text(pay, cols.pay, y, { align: 'right' });
    pdf.text(bal, cols.bal, y, { align: 'right' });
    y += 4;
    pdf.setDrawColor(226, 232, 240).setLineWidth(0.5).line(x0, y, x1, y);
    y += 10;
  };
  if (d.fromDate) row(d.fromDate, '', 'Balance brought forward', '', '', m(d.openingBalance), true);
  for (const l of d.lines) row(l.date, l.ref, l.description, l.charge ? m(l.charge) : '', l.credit ? m(l.credit) : '', m(l.balance));
  if (d.lines.length === 0) {
    room(20);
    pdf.setFontSize(9).setTextColor(...grey).text('No activity in this period.', x0 + 4, y);
    y += 16;
  }
  room(30);
  pdf.setDrawColor(...ink).setLineWidth(1.5).line(x0, y, x1, y);
  y += 13;
  pdf.setFont('courier', 'bold').setFontSize(9).setTextColor(...ink);
  pdf.text('TOTAL', cols.date, y);
  pdf.text(m(d.totalCharges), cols.chg, y, { align: 'right' });
  pdf.text(m(d.totalCredits), cols.pay, y, { align: 'right' });
  pdf.text(m(d.closingBalance), cols.bal, y, { align: 'right' });
  y += 26;

  if (d.openInvoices.length) {
    room(60 + d.openInvoices.length * 12);
    pdf.setFontSize(8).setTextColor(...grey).text('OPEN INVOICES (TODAY)', x0, y);
    y += 12;
    for (const o of d.openInvoices) {
      room(14);
      pdf.setFont('courier', 'normal').setFontSize(8.5).setTextColor(...ink);
      pdf.text(o.number, cols.date, y);
      pdf.text(`${o.issueDate}${o.dueDate ? '  due ' + o.dueDate : ''}`, cols.ref, y);
      pdf.text(o.daysOverdue ? `${o.daysOverdue}d overdue` : 'current', cols.chg, y, { align: 'right' });
      pdf.text(m(o.balance), cols.bal, y, { align: 'right' });
      y += 12;
    }
    y += 8;
    room(40);
    const labels: [string, number][] = [
      ['Current', d.aging.current],
      ['1-30', d.aging.d1_30],
      ['31-60', d.aging.d31_60],
      ['61-90', d.aging.d61_90],
      ['90+', d.aging.d90plus],
    ];
    const cw = (x1 - x0) / 5;
    pdf.setDrawColor(203, 213, 225).setLineWidth(0.5).rect(x0, y, x1 - x0, 32);
    labels.forEach(([lab, v], i) => {
      const cx = x0 + cw * i + cw / 2;
      pdf.setFont('courier', 'normal').setFontSize(7.5).setTextColor(...grey).text(lab.toUpperCase(), cx, y + 12, { align: 'center' });
      pdf.setFont('courier', 'bold').setFontSize(9).setTextColor(...ink).text(m(v), cx, y + 25, { align: 'center' });
    });
    y += 48;
  }

  const s = d.settings;
  if (s.paymentInstructions || s.bankName) {
    room(50);
    pdf.setDrawColor(203, 213, 225).setLineDashPattern([3, 3], 0).line(x0, y, x1, y).setLineDashPattern([], 0);
    y += 14;
    pdf.setFont('courier', 'bold').setFontSize(8).setTextColor(...grey).text('PAYMENT METHODS', x0, y);
    y += 12;
    pdf.setFont('courier', 'normal').setFontSize(9).setTextColor(...ink);
    if (s.paymentInstructions) {
      for (const ln of pdf.splitTextToSize(s.paymentInstructions, x1 - x0)) {
        room(12);
        pdf.text(ln, x0, y);
        y += 11;
      }
    }
    if (s.bankName) {
      pdf.text([s.bankName, s.bankAccountName, s.bankAccountNumber].filter(Boolean).join(' - '), x0, y);
      y += 11;
    }
  }
  if (s.taxRegistrationNumber) {
    room(14);
    pdf.setFontSize(8).setTextColor(...grey).text(`TIN: ${s.taxRegistrationNumber}`, x0, y + 4);
  }
  return pdf;
}
