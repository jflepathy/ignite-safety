'use client';

import { useState } from 'react';

/**
 * Renders the element at `targetId` to a real PDF file (via html2canvas +
 * jsPDF, entirely client-side) and saves it straight to the browser's
 * default download location — no "Save As" dialog, no confirmation step,
 * because jsPDF's save() triggers a plain <a download> click under the hood
 * (Session 11). The filename is the document's own form number so it lands
 * in Downloads already named sensibly.
 */
export default function DownloadPdfButton({
  targetId,
  fileName,
  label = '⬇ Download PDF',
}: {
  targetId: string;
  fileName: string;
  label?: string;
}) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  async function handleClick() {
    setError('');
    setWorking(true);
    try {
      const el = document.getElementById(targetId);
      if (!el) throw new Error('Nothing found to export.');

      const [{ default: html2canvas }, jsPdfModule] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);
      const { jsPDF } = jsPdfModule;

      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`${fileName}.pdf`);
    } catch (e: any) {
      setError(e?.message ?? 'Could not generate PDF.');
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-end">
      <button type="button" className="btn-secondary" onClick={handleClick} disabled={working}>
        {working ? 'Preparing…' : label}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
