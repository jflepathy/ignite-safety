import { jsPDF } from 'jspdf';
import { formatMoney } from '@/lib/money';
import type { InvoiceDocumentData } from '@/components/billing/invoice-document';

/**
 * Builds a real, text-based PDF for Invoice/Estimate/Sales Receipt —
 * replacing the old Download PDF flow, which rendered the on-screen DOM
 * to a raster image (first via html2canvas, later html-to-image — see the
 * removed history notes in download-pdf-button.tsx) and embedded that
 * *picture* of the document into a PDF page. That approach could be made
 * to visually resemble a real print, round after round, but it could
 * never actually BE one: the "text" in a downloaded PDF was always
 * literally pixels, not characters — not selectable, not searchable, not
 * copy-pasteable, and needlessly large as a file. That's the root
 * complaint that finally ended the whack-a-mole (Session 22, round 7).
 *
 * This module hand-draws the same print layout using jsPDF's own text/
 * line primitives (the same approach already used, correctly, by
 * src/components/expenses/download-expense-pdf-button.tsx) — real glyphs,
 * real font, real page geometry, no screenshot anywhere in the pipeline.
 *
 * It takes the exact same `InvoiceDocumentData` shape the on-screen/print
 * `<InvoiceDocument>` component renders from, so a page builds ONE data
 * object and hands it to both — the print/PDF layouts can still diverge
 * in code (one is JSX+CSS, the other is direct PDF drawing — there's no
 * way around maintaining both), but the *data* can never drift, which was
 * never the case before this.
 *
 * Layout is a deliberate hand-translation of InvoiceDocument's print-
 * visible output only — the on-screen-only elements (`print:hidden`:
 * the subtotal/discount/tax breakdown, the customer-message box, the
 * "prices shown include/exclude tax" note) are correctly left out here
 * too, exactly as they're left out of an actual print. Font sizes convert
 * CSS px to PDF pt at the same 0.75pt/px ratio measured exact against
 * this app's real browser print output in Session 22 round 5. Page
 * margins (14mm top/bottom, 12mm sides) match the real `@page` print rule
 * in globals.css exactly. This is a close, presentable hand-translation
 * of the print layout, not a pixel-identical reproduction — real drawn
 * text can't be captured-and-pasted the way a screenshot was, so exact
 * pixel placement was traded for the much bigger win: this is now an
 * actual digital document.
 */

const MM_TO_PT = 2.834645669;
const MARGIN_TOP = 14 * MM_TO_PT;
const MARGIN_BOTTOM = 14 * MM_TO_PT;
const MARGIN_SIDE = 12 * MM_TO_PT;

// The document's own internal `p-8` (32px) padding inside the print area,
// converted at the same CSS-px-to-pt ratio as everything else here —
// applied on top of the page's own @page margin so section insets line
// up with where the real print puts them.
const PAD = 32 * 0.75; // 24pt

const PX = 0.75; // CSS px -> pt (exact, see Session 22 round 5)
const FS = {
  xs: 12 * PX, // 9
  sm: 14 * PX, // 10.5
  lg: 18 * PX, // 13.5
  xl: 20 * PX, // 15
  xxxl: 30 * PX, // 22.5
};

type RGB = [number, number, number];
const COLOR = {
  ink: [15, 23, 42] as RGB,
  slate400: [148, 163, 184] as RGB,
  slate500: [100, 116, 139] as RGB,
  slate600: [71, 85, 105] as RGB,
  slate800: [30, 41, 59] as RGB,
  slate200: [226, 232, 240] as RGB,
  brand600: [236, 47, 47] as RGB,
};

async function loadLogo(logoUrl: string): Promise<{ dataUrl: string; width: number; height: number } | null> {
  try {
    const res = await fetch(logoUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const dims: { width: number; height: number } = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = reject;
      img.src = dataUrl;
    });
    return { dataUrl, ...dims };
  } catch {
    return null; // fall back to the text wordmark rather than fail the whole PDF
  }
}

export async function buildDocumentPdf(doc: InvoiceDocumentData): Promise<jsPDF> {
  const {
    settings,
    documentLabel = 'INVOICE',
    documentNumber,
    issueDate,
    dueDate,
    poNumber,
    terms,
    customer,
    lineItems,
    currency,
    balanceDue,
    totalLabel = 'Balance Due',
  } = doc;

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentX0 = MARGIN_SIDE + PAD;
  const contentX1 = pageWidth - MARGIN_SIDE - PAD;
  const contentWidth = contentX1 - contentX0;
  const contentBottom = pageHeight - MARGIN_BOTTOM - PAD;

  let y = MARGIN_TOP + PAD;

  function setColor(rgb: RGB) {
    pdf.setTextColor(rgb[0], rgb[1], rgb[2]);
  }
  function setDrawColor(rgb: RGB) {
    pdf.setDrawColor(rgb[0], rgb[1], rgb[2]);
  }
  function line(x1: number, y1: number, x2: number, y2: number, rgb: RGB, widthPt: number, dashed = false) {
    setDrawColor(rgb);
    pdf.setLineWidth(widthPt);
    if (dashed) pdf.setLineDashPattern([1.5, 1.5], 0);
    else pdf.setLineDashPattern([], 0);
    pdf.line(x1, y1, x2, y2);
  }
  function ensureRoom(neededHeight: number) {
    if (y + neededHeight > contentBottom) {
      pdf.addPage();
      y = MARGIN_TOP + PAD;
    }
  }

  // --- Header band: company name/address/contact left, logo (or wordmark) right ---
  const headerTop = y;
  pdf.setFont('courier', 'bold');
  pdf.setFontSize(FS.lg);
  setColor(COLOR.ink);
  pdf.text(settings.companyName, contentX0, y + FS.lg);
  y += FS.lg + 4;

  pdf.setFont('courier', 'normal');
  pdf.setFontSize(FS.sm);
  setColor(COLOR.slate500);
  const addressLines = (settings.companyAddress ?? '').split('\n').filter(Boolean);
  for (const l of addressLines) {
    pdf.text(l, contentX0, y + FS.sm);
    y += FS.sm + 2;
  }
  if (settings.companyPhone) {
    pdf.text(settings.companyPhone, contentX0, y + FS.sm);
    y += FS.sm + 2;
  }
  if (settings.companyEmail) {
    pdf.text(settings.companyEmail, contentX0, y + FS.sm);
    y += FS.sm + 2;
  }

  // Logo / wordmark, right-aligned within the header band, vertically
  // spanning roughly the same block as the company info. Tailwind's h-24
  // is 6rem = 96px (NOT 24px — caught in Session 22 round 7 live
  // verification, where this first shipped as a postage-stamp-sized logo).
  const logoBoxHeight = 96 * PX; // 72pt
  if (settings.logoUrl) {
    const logo = await loadLogo(settings.logoUrl);
    if (logo) {
      const logoHeight = logoBoxHeight;
      const logoWidth = (logo.width / logo.height) * logoHeight;
      const format = logo.dataUrl.startsWith('data:image/png') ? 'PNG' : logo.dataUrl.startsWith('data:image/webp') ? 'WEBP' : 'JPEG';
      try {
        pdf.addImage(logo.dataUrl, format, contentX1 - logoWidth, headerTop, logoWidth, logoHeight);
      } catch {
        drawWordmark();
      }
    } else {
      drawWordmark();
    }
  } else {
    drawWordmark();
  }
  function drawWordmark() {
    const parts = settings.companyName.split(' ');
    const first = (parts[0] ?? '').toUpperCase();
    const rest = parts.slice(1).join(' ').toUpperCase();
    pdf.setFont('courier', 'bold');
    pdf.setFontSize(FS.lg);
    const firstWidth = pdf.getTextWidth(first + ' ');
    const restWidth = pdf.getTextWidth(rest);
    const totalWidth = firstWidth + restWidth;
    setColor(COLOR.brand600);
    pdf.text(first, contentX1 - totalWidth, headerTop + FS.lg);
    setColor(COLOR.ink);
    pdf.text(rest, contentX1 - restWidth, headerTop + FS.lg);
  }

  y = Math.max(y, headerTop + logoBoxHeight) + PAD;

  // --- Document label + number row, with a heavy rule underneath ---
  pdf.setFont('courier', 'bold');
  pdf.setFontSize(FS.xxxl);
  setColor(COLOR.ink);
  pdf.text(documentLabel.toUpperCase(), contentX0, y + FS.xxxl * 0.8);

  pdf.setFont('courier', 'normal');
  pdf.setFontSize(FS.xs);
  setColor(COLOR.slate400);
  pdf.text(`${documentLabel.toUpperCase()} NO.`, contentX1, y + FS.xs, { align: 'right' });
  pdf.setFont('courier', 'bold');
  pdf.setFontSize(FS.lg);
  setColor(COLOR.brand600);
  pdf.text(documentNumber, contentX1, y + FS.xs + FS.lg + 2, { align: 'right' });

  y += Math.max(FS.xxxl, FS.xs + FS.lg + 6) + 10;
  line(contentX0, y, contentX1, y, COLOR.ink, 1.5);
  y += 18;

  // --- Bill To (left) / Date-Terms-Due-PO meta (right) ---
  const billToTop = y;
  pdf.setFont('courier', 'bold');
  pdf.setFontSize(FS.xs);
  setColor(COLOR.slate400);
  pdf.text('BILL TO', contentX0, y + FS.xs);
  y += FS.xs + 5;

  pdf.setFont('courier', 'bold');
  pdf.setFontSize(FS.sm);
  setColor(COLOR.ink);
  pdf.text(customer.displayName, contentX0, y + FS.sm);
  y += FS.sm + 2;

  pdf.setFont('courier', 'normal');
  setColor(COLOR.slate500);
  for (const l of (customer.address ?? '').split('\n').filter(Boolean)) {
    pdf.text(l, contentX0, y + FS.sm);
    y += FS.sm + 2;
  }
  if (customer.phone) {
    pdf.text(customer.phone, contentX0, y + FS.sm);
    y += FS.sm + 2;
  }
  const billToBottom = y;

  // Right-hand meta block
  let metaY = billToTop;
  const metaRows: [string, string][] = [['Date', issueDate]];
  if (terms) metaRows.push(['Terms', terms]);
  if (dueDate) metaRows.push(['Due Date', dueDate]);
  if (poNumber) metaRows.push(['PO Number', poNumber]);
  for (const [label, value] of metaRows) {
    pdf.setFont('courier', 'bold');
    pdf.setFontSize(FS.xs);
    setColor(COLOR.slate400);
    pdf.text(label.toUpperCase(), contentX1, metaY + FS.xs, { align: 'right' });
    metaY += FS.xs + 3;
    pdf.setFont('courier', 'bold');
    pdf.setFontSize(FS.sm);
    setColor(COLOR.ink);
    pdf.text(value, contentX1, metaY + FS.sm, { align: 'right' });
    metaY += FS.sm + 6;
  }

  y = Math.max(billToBottom, metaY) + 20;

  // --- Line items table ---
  const col = {
    sku: { x: contentX0, w: 60 },
    desc: { x: contentX0 + 60, w: contentWidth - 60 - 46 - 85 - 90 },
  };
  const colQtyRight = contentX0 + 60 + col.desc.w + 46;
  const colRateRight = colQtyRight + 85;
  const colAmountRight = colRateRight + 90;

  function drawTableHeader() {
    pdf.setFont('courier', 'bold');
    pdf.setFontSize(FS.xs);
    setColor(COLOR.slate500);
    pdf.text('ACTIVITY', col.sku.x, y + FS.xs);
    pdf.text('DESCRIPTION', col.desc.x, y + FS.xs);
    pdf.text('QTY', colQtyRight, y + FS.xs, { align: 'right' });
    pdf.text('RATE', colRateRight, y + FS.xs, { align: 'right' });
    pdf.text('AMOUNT', colAmountRight, y + FS.xs, { align: 'right' });
    y += FS.xs + 6;
    line(contentX0, y, contentX1, y, COLOR.slate800, 1.5);
    y += 10;
  }

  ensureRoom(FS.xs + 20);
  drawTableHeader();

  pdf.setFont('courier', 'normal');
  pdf.setFontSize(FS.sm);
  const descLineHeight = FS.sm + 3;
  for (const li of lineItems) {
    const descLines = pdf.splitTextToSize(li.description || '', col.desc.w - 6);
    const rowHeight = Math.max(1, descLines.length) * descLineHeight + 8;

    if (y + rowHeight > contentBottom) {
      pdf.addPage();
      y = MARGIN_TOP + PAD;
      drawTableHeader();
      pdf.setFont('courier', 'normal');
      pdf.setFontSize(FS.sm);
    }

    const rowTop = y;
    pdf.setFont('courier', 'normal');
    pdf.setFontSize(FS.xs);
    setColor(COLOR.slate500);
    pdf.text(li.sku ?? '—', col.sku.x, rowTop + FS.xs);

    pdf.setFont('courier', 'normal');
    pdf.setFontSize(FS.sm);
    setColor(COLOR.ink);
    let dy = rowTop;
    for (const dl of descLines) {
      pdf.text(dl, col.desc.x, dy + FS.sm);
      dy += descLineHeight;
    }

    setColor(COLOR.ink);
    pdf.text(li.quantity, colQtyRight, rowTop + FS.sm, { align: 'right' });
    pdf.text(formatMoney(li.unitPrice, currency), colRateRight, rowTop + FS.sm, { align: 'right' });
    pdf.setFont('courier', 'bold');
    pdf.text(formatMoney(li.lineTotal, currency), colAmountRight, rowTop + FS.sm, { align: 'right' });

    y += rowHeight;
  }

  line(contentX0, y, contentX1, y, COLOR.slate800, 1.5);
  y += 20;

  // --- Payment Methods / TIN / Bank Details (left) and Total (right), side by side ---
  ensureRoom(90);
  const footerTop = y;
  const paymentBlockWidth = 220;
  const totalsBlockWidth = 220;

  let py = footerTop;
  pdf.setFont('courier', 'bold');
  pdf.setFontSize(FS.xs);
  setColor(COLOR.slate600);
  pdf.text('PAYMENT METHODS', contentX0, py + FS.xs);
  py += FS.xs + 4;

  pdf.setFont('courier', 'normal');
  setColor(COLOR.slate500);
  const payLines = pdf.splitTextToSize(settings.paymentInstructions ?? '', paymentBlockWidth);
  for (const l of payLines) {
    pdf.text(l, contentX0, py + FS.xs);
    py += FS.xs + 3;
  }
  if (settings.taxRegistrationNumber) {
    py += 4;
    pdf.setFont('courier', 'bold');
    setColor(COLOR.slate600);
    pdf.text(`TIN: ${settings.taxRegistrationNumber}`, contentX0, py + FS.xs);
    py += FS.xs + 3;
  }
  if (settings.bankName) {
    py += 4;
    pdf.setFont('courier', 'bold');
    setColor(COLOR.slate600);
    pdf.text('BANK DETAILS', contentX0, py + FS.xs);
    py += FS.xs + 4;
    pdf.setFont('courier', 'normal');
    setColor(COLOR.slate500);
    const bankLines = [settings.bankName, settings.bankAccountName, settings.bankAccountNumber ? `Acc No.: ${settings.bankAccountNumber}` : null].filter(
      (l): l is string => !!l
    );
    for (const l of bankLines) {
      pdf.text(l, contentX0, py + FS.xs);
      py += FS.xs + 3;
    }
  }

  // Total block, right-aligned
  const totalsX0 = contentX1 - totalsBlockWidth;
  line(totalsX0, footerTop, contentX1, footerTop, COLOR.slate200, 1);
  const totalsY = footerTop + 16;
  pdf.setFont('courier', 'bold');
  pdf.setFontSize(FS.xs);
  setColor(COLOR.slate500);
  pdf.text(totalLabel.toUpperCase(), totalsX0, totalsY + FS.xl * 0.7);
  pdf.setFont('courier', 'bold');
  pdf.setFontSize(FS.xl);
  setColor(COLOR.ink);
  pdf.text(formatMoney(balanceDue, currency), contentX1, totalsY + FS.xl * 0.7, { align: 'right' });

  y = Math.max(py, totalsY + FS.xl) + 30;

  // --- Footer thank-you line ---
  ensureRoom(40);
  line(contentX0, y, contentX1, y, COLOR.slate200, 1, true);
  y += 18;
  pdf.setFont('courier', 'normal');
  pdf.setFontSize(FS.xs);
  setColor(COLOR.slate400);
  pdf.text('Thanking you for your business!', (contentX0 + contentX1) / 2, y, { align: 'center' });

  return pdf;
}
