'use client';

import { useState } from 'react';
import type { InvoiceDocumentData } from '@/components/billing/invoice-document';

/**
 * Downloads a real, text-based PDF of Invoice/Estimate/Sales Receipt.
 *
 * History (Session 22): this used to render by screenshotting the on-screen
 * DOM (html2canvas, then html-to-image) and embedding that raster image
 * into a PDF page. Round after round chased that image into visually
 * matching a real print — fixing colors/fonts, then margins, then font
 * size — but the fundamental complaint never actually went away: what
 * downloaded was always a *picture* of the document, not a real digital
 * one (not selectable, not searchable, not copy-pasteable, needlessly
 * large). Round 7: replaced entirely with `buildDocumentPdf`
 * (src/lib/pdf/build-document-pdf.ts), which draws real PDF text/lines
 * directly — the same approach already used correctly, and all along, by
 * the Expenses PDF button. See that module's own header comment for the
 * full layout translation. No DOM capture, no image, anywhere in this
 * path any more.
 */
export default function DownloadPdfButton({
  document: documentData,
  fileName,
  label = '⬇ Download PDF',
}: {
  document: InvoiceDocumentData;
  fileName: string;
  label?: string;
}) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  async function handleClick() {
    setError('');
    setWorking(true);
    try {
      const { buildDocumentPdf } = await import('@/lib/pdf/build-document-pdf');
      const pdf = await buildDocumentPdf(documentData);
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
