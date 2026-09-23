'use client';

import { useState } from 'react';

/**
 * Pulls every rule inside an `@media print { ... }` block out of the live
 * page's stylesheets and returns them as plain (unconditional) CSS text.
 *
 * Why: html2canvas renders a snapshot of the DOM exactly as the *screen*
 * currently shows it — it has no concept of print media, so none of the
 * app's `print:*` Tailwind utilities (the ones that strip the colored
 * header down to white, hide the on-screen subtotal/discount/tax
 * breakdown, drop the rounded card corners, etc. — see the `.print-area`
 * block in globals.css) ever take effect in a downloaded PDF. That's
 * exactly why "Download PDF" used to look different from actually
 * printing the same document (Invoice, Estimate, and Sales Receipt all
 * share this one button, so all three were affected). Re-injecting the
 * print rules unconditionally into the clone html2canvas renders from
 * makes the two paths produce the same page.
 */
function collectPrintOnlyCss(doc: Document): string {
  let css = '';
  for (const sheet of Array.from(doc.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // cross-origin stylesheet — can't read its rules, skip it
    }
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSMediaRule && rule.media.mediaText.includes('print')) {
        for (const inner of Array.from(rule.cssRules)) {
          css += inner.cssText + '\n';
        }
      }
    }
  }
  return css;
}

/**
 * Renders the element at `targetId` to a real PDF file (via html2canvas +
 * jsPDF, entirely client-side) and saves it straight to the browser's
 * default download location — no "Save As" dialog, no confirmation step,
 * because jsPDF's save() triggers a plain <a download> click under the hood
 * (Session 11). The filename is the document's own form number so it lands
 * in Downloads already named sensibly. The captured snapshot is made to
 * match actual printing (Session 22) via `collectPrintOnlyCss` above.
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

      const printCss = collectPrintOnlyCss(document);
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        onclone: (clonedDoc) => {
          const style = clonedDoc.createElement('style');
          style.textContent = printCss;
          clonedDoc.head.appendChild(style);
        },
      });
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
