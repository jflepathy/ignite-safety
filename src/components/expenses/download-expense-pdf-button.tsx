'use client';

import { useState } from 'react';

/**
 * Expenses have no live printable document (they're recorded via a modal,
 * not a detail page), so unlike Invoice/Sales Receipt/Estimate this builds
 * the PDF straight from the row's data with jsPDF's own text/line drawing
 * instead of rendering a DOM node — no html2canvas needed. Saves silently
 * to the browser's default download location, named after the expense
 * number (Session 11).
 */
export default function DownloadExpensePdfButton({
  expenseNumber,
  companyName,
  date,
  account,
  vendor,
  description,
  method,
  reference,
  amount,
  currency,
}: {
  expenseNumber: string;
  companyName: string;
  date: string;
  account: string;
  vendor: string;
  description: string;
  method: string;
  reference: string;
  amount: string;
  currency: string;
}) {
  const [working, setWorking] = useState(false);

  async function handleClick() {
    setWorking(true);
    try {
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      pdf.setFont('courier', 'bold');
      pdf.setFontSize(16);
      pdf.text(companyName, 48, 60);
      pdf.setFontSize(20);
      pdf.text('EXPENSE RECEIPT', 48, 100);

      pdf.setFont('courier', 'normal');
      pdf.setFontSize(11);
      const rows: [string, string][] = [
        ['Expense No.', expenseNumber],
        ['Date', date],
        ['Category', account],
        ['Vendor / Supplier', vendor || '—'],
        ['Description', description || '—'],
        ['Payment Method', method],
        ['Reference', reference || '—'],
      ];
      let y = 140;
      for (const [label, value] of rows) {
        pdf.text(label, 48, y);
        pdf.text(value, 220, y);
        y += 22;
      }

      y += 10;
      pdf.setLineWidth(1);
      pdf.line(48, y, 548, y);
      y += 30;
      pdf.setFont('courier', 'bold');
      pdf.setFontSize(14);
      pdf.text('AMOUNT', 48, y);
      pdf.text(`${currency} ${amount}`, 400, y);

      pdf.save(`${expenseNumber}.pdf`);
    } finally {
      setWorking(false);
    }
  }

  return (
    <button type="button" className="text-xs font-medium text-brand-600 hover:underline disabled:opacity-50" onClick={handleClick} disabled={working}>
      {working ? '…' : '⬇ PDF'}
    </button>
  );
}
