import { jsPDF } from 'jspdf';
import type { CertificateData } from '@/lib/certificate';

const MM = 2.834645669;

export function buildCertificatePdf(d: CertificateData): jsPDF {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const x0 = 14 * MM;
  const x1 = W - 14 * MM;
  const bottom = H - 16 * MM;
  const ink: [number, number, number] = [15, 23, 42];
  const grey: [number, number, number] = [100, 116, 139];
  const red: [number, number, number] = [236, 47, 47];
  let y = 14 * MM + 10;

  pdf.setFont('courier', 'bold').setFontSize(13).setTextColor(...ink).text(d.settings.companyName, x0, y);
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
  pdf.setFont('courier', 'bold').setFontSize(17).setTextColor(...ink).text('CERTIFICATE OF SERVICING', x0, y);
  pdf.setFontSize(8).setTextColor(...grey).text('CERTIFICATE NO.', x1, y - 12, { align: 'right' });
  pdf.setFontSize(13).setTextColor(...red).text(d.certificateNumber, x1, y + 2, { align: 'right' });
  y += 14;
  pdf.setFont('courier', 'normal').setFontSize(9).setTextColor(...grey).text('Fire safety equipment', x0, y);
  y += 22;

  // customer + meta
  pdf.setFont('courier', 'bold').setFontSize(8).setTextColor(...grey).text('CUSTOMER', x0, y);
  const metaX = x1 - 160;
  let my = y;
  const meta: [string, string, boolean][] = [
    ['SERVICE DATE', d.serviceDate, false],
    ['NEXT DUE', d.nextDueDate, true],
    ['WORK ORDER', d.workOrderNumber, false],
  ];
  if (d.invoiceNumber) meta.push(['INVOICE', d.invoiceNumber, false]);
  for (const [k, v, hi] of meta) {
    pdf.setFont('courier', 'bold').setFontSize(7.5).setTextColor(...grey).text(k, metaX, my);
    pdf.setFontSize(9.5).setTextColor(...(hi ? red : ink)).text(v, x1, my, { align: 'right' });
    my += 13;
  }
  y += 12;
  pdf.setFont('courier', 'bold').setFontSize(10.5).setTextColor(...ink).text(d.customer.displayName, x0, y);
  pdf.setFont('courier', 'normal').setFontSize(9).setTextColor(...grey);
  y += 11;
  for (const line of [...(d.customer.address ?? '').split('\n'), d.customer.phone ?? '']) {
    if (!line.trim()) continue;
    pdf.text(line, x0, y);
    y += 11;
  }
  if (d.siteAddress) {
    for (const ln of pdf.splitTextToSize(`Site: ${d.siteAddress}`, metaX - x0 - 10)) {
      pdf.text(ln, x0, y);
      y += 11;
    }
  }
  y = Math.max(y, my) + 12;

  const room = (n: number, redraw?: () => void) => {
    if (y + n > bottom) {
      pdf.addPage();
      y = 14 * MM + 10;
      redraw?.();
    }
  };

  if (d.items.length) {
    const c = { no: x0, type: x0 + 22, ser: x0 + 120, loc: x0 + 210, res: x0 + 300, note: x0 + 345 };
    const head = () => {
      pdf.setFont('courier', 'bold').setFontSize(7.5).setTextColor(...grey);
      pdf.text('#', c.no, y);
      pdf.text('EQUIPMENT', c.type, y);
      pdf.text('SERIAL NO.', c.ser, y);
      pdf.text('LOCATION', c.loc, y);
      pdf.text('RESULT', c.res, y);
      pdf.text('NOTES', c.note, y);
      y += 4;
      pdf.setDrawColor(...ink).setLineWidth(1).line(x0, y, x1, y);
      y += 12;
    };
    head();
    for (const it of d.items) {
      const noteLines = pdf.splitTextToSize(it.notes || '', x1 - c.note);
      const h = Math.max(1, noteLines.length) * 10 + 6;
      room(h, head);
      pdf.setFont('courier', 'normal').setFontSize(8.5).setTextColor(...ink);
      pdf.text(String(it.no), c.no, y);
      pdf.text(it.type.slice(0, 16), c.type, y);
      pdf.text((it.serial || '-').slice(0, 14), c.ser, y);
      pdf.text((it.location || '-').slice(0, 14), c.loc, y);
      pdf.setFont('courier', 'bold').setTextColor(...(it.result === 'FAIL' ? red : ink)).text(it.result, c.res, y);
      pdf.setFont('courier', 'normal').setTextColor(...grey);
      noteLines.forEach((ln: string, i: number) => pdf.text(ln, c.note, y + i * 10));
      y += h - 2;
      pdf.setDrawColor(226, 232, 240).setLineWidth(0.5).line(x0, y, x1, y);
      y += 10;
    }
    y += 8;
  }

  if (d.summary.length) {
    room(30 + d.summary.length * 13);
    pdf.setFont('courier', 'bold').setFontSize(8).setTextColor(...grey).text(d.items.length ? 'OTHER ITEMS SERVICED' : 'ITEMS SERVICED', x0, y);
    y += 12;
    for (const l of d.summary) {
      room(14);
      pdf.setFont('courier', 'normal').setFontSize(9).setTextColor(...ink).text(l.label.slice(0, 70), x0, y);
      pdf.text(String(l.quantity), x1, y, { align: 'right' });
      y += 4;
      pdf.setDrawColor(226, 232, 240).setLineWidth(0.5).line(x0, y, x1, y);
      y += 10;
    }
    y += 6;
  }

  if (d.technicianNotes) {
    pdf.setFont('courier', 'normal').setFontSize(9).setTextColor(...ink);
    for (const ln of pdf.splitTextToSize(`Remarks: ${d.technicianNotes}`, x1 - x0)) {
      room(12);
      pdf.text(ln, x0, y);
      y += 11;
    }
    y += 6;
  }

  pdf.setFont('courier', 'normal').setFontSize(8).setTextColor(...grey);
  for (const ln of pdf.splitTextToSize(d.declaration, x1 - x0)) {
    room(11);
    pdf.text(ln, x0, y);
    y += 10;
  }

  room(110);
  y += 40;
  const half = (x1 - x0 - 40) / 2;
  if (d.customerSignatureDataUrl) {
    try {
      pdf.addImage(d.customerSignatureDataUrl, 'PNG', x0, y - 38, 110, 36);
    } catch {
      /* skip unreadable signature */
    }
  }
  pdf.setDrawColor(...ink).setLineWidth(1);
  pdf.line(x0, y, x0 + half, y);
  pdf.line(x1 - half, y, x1, y);
  y += 11;
  pdf.setFont('courier', 'bold').setFontSize(7.5).setTextColor(...grey);
  pdf.text('CUSTOMER', x0, y);
  pdf.text('TECHNICIAN SIGNATURE', x1 - half, y);
  y += 11;
  pdf.setFont('courier', 'normal').setFontSize(9.5).setTextColor(...ink);
  pdf.text(d.customerSignedName ?? '', x0, y);
  pdf.text(d.technicians.join(', ').slice(0, 40), x1 - half, y);
  if (d.settings.taxRegistrationNumber) {
    pdf.setFontSize(8).setTextColor(...grey).text(`TIN: ${d.settings.taxRegistrationNumber}`, x0, y + 28);
  }
  return pdf;
}
