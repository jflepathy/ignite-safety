'use client';

import { useState } from 'react';

/**
 * Pulls every rule inside an `@media print { ... }` block out of the live
 * page's stylesheets, rewrites each selector so it only matches inside
 * `scopeSelector`, and returns the result as plain (unconditional) CSS
 * text. Used to make an off-screen clone of a document look exactly like
 * it would when actually printed, without ever touching the live page's
 * own styling (see `handleClick` below for why it needs a clone at all).
 */
function collectScopedPrintCss(doc: Document, scopeSelector: string): string {
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
          if (inner instanceof CSSStyleRule) {
            const scoped = inner.selectorText
              .split(',')
              .map((s) => `${scopeSelector} ${s.trim()}`)
              .join(', ');
            css += `${scoped} { ${inner.style.cssText} }\n`;
          } else {
            // A nested at-rule (rare inside @media print here) — keep as-is
            // rather than trying to rewrite its selector.
            css += inner.cssText + '\n';
          }
        }
      }
    }
  }
  return css;
}

/**
 * Renders the element at `targetId` to a real PDF file and saves it
 * straight to the browser's default download location — no "Save As"
 * dialog, no confirmation step, because jsPDF's save() triggers a plain
 * <a download> click under the hood (Session 11). The filename is the
 * document's own form number so it lands in Downloads already named
 * sensibly.
 *
 * Session 22 history:
 *
 * 1. This used to render via html2canvas, which reimplements CSS layout
 *    and painting from scratch instead of using the browser's own
 *    rendering engine. It has no concept of print media (so none of this
 *    app's `print:*` Tailwind utilities — the ones that strip the header
 *    to plain white, hide the on-screen subtotal/discount/tax breakdown,
 *    and drop the rounded card corners for a clean printed page — ever
 *    took effect), which was the first fix attempted here. But it also
 *    turned out not to understand Tailwind's modern
 *    `rgb(r g b / var(--tw-*-opacity))` color syntax or its gradient
 *    custom properties at all, and would silently fall back to the
 *    browser's default font/colors for anything that used them — visibly
 *    wrong text color and a completely wrong (non-monospace) font  in the
 *    downloaded PDF, confirmed by downloading a real Estimate and
 *    comparing it side-by-side with an actual print of the same one.
 *    html2canvas is effectively unmaintained and this is a known
 *    limitation of it, not something fixable by tweaking its options.
 * 2. Fix: render via `html-to-image` instead, which (via an SVG
 *    `<foreignObject>`) hands the actual HTML/CSS to the browser's own
 *    renderer rather than reimplementing it, so modern CSS just works.
 * 3. To still make the *printed* look win over the *on-screen* look (an
 *    Estimate's on-screen subtotal breakdown and blue header shouldn't
 *    appear in the downloaded PDF, matching actual printing), the
 *    target element is cloned into an off-screen container first, the
 *    print-only CSS rules are re-injected there — scoped so they only
 *    ever apply inside that detached clone — and only the clone is
 *    captured. Nothing about the live, visible page is touched.
 * 4. (Round 4.) The page size was already correct A4 — the actual
 *    complaint was that the downloaded PDF had the captured image
 *    stretched edge-to-edge with zero margin, while an actual browser
 *    print goes through `@page { margin: 14mm 12mm }` (globals.css,
 *    `@media print`) and has a proper white border. Fixed by inset-ing
 *    the image by that same 14mm/12mm on every page instead of drawing
 *    it full-bleed — see the margin math below.
 * 5. (Round 5.) Font size still didn't match print — the clone used to
 *    be captured at the LIVE on-screen width (`el.offsetWidth`, whatever
 *    the browser window happened to be, e.g. ~896px), then that whole
 *    image was squeezed down to fit the fixed A4 usable width. A real
 *    browser print instead renders the same CSS pixels directly onto the
 *    physical page (1 CSS px = 0.75pt, independent of window width) —
 *    so on any screen wider than the print area, downloaded text came
 *    out visibly smaller than printed text, and by an amount that
 *    depended on the user's window size, not a fixed ratio. Fixed by
 *    capturing the clone at the *print-equivalent* pixel width instead
 *    (the width that, at 0.75pt/px, exactly fills the usable print
 *    area) so wrapping and font size match print by construction, then
 *    nudging the whole thing down by ~2pt (measured against this
 *    template's dominant `text-sm`/14px body size) per the user's own
 *    follow-up ask, once print and download actually matched.
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
    let offscreen: HTMLDivElement | null = null;
    let styleTag: HTMLStyleElement | null = null;
    try {
      const el = document.getElementById(targetId);
      if (!el) throw new Error('Nothing found to export.');

      const htmlToImage = await import('html-to-image');
      const jsPdfModule = await import('jspdf');
      const { jsPDF } = jsPdfModule;

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Same margins as the real @page print rule (globals.css, 14mm top/
      // bottom, 12mm left/right) so the image doesn't bleed to the edge
      // the way it used to — a plain top-left addImage(0,0,pageWidth,...)
      // with no inset at all.
      const MM_TO_PT = 2.834645669;
      const marginTop = 14 * MM_TO_PT;
      const marginBottom = 14 * MM_TO_PT;
      const marginSide = 12 * MM_TO_PT;
      const usableWidth = pageWidth - marginSide * 2;
      const usableHeight = pageHeight - marginTop - marginBottom;

      // A real browser print renders CSS pixels straight onto the physical
      // page at 0.75pt per CSS px (96 CSS px/in, 72pt/in) — independent of
      // the on-screen window width. To make the downloaded PDF's font size
      // match that (rather than whatever ratio falls out of squeezing the
      // live on-screen width into the page), capture the clone at the CSS
      // pixel width that itself maps to the usable print area at that same
      // 0.75pt/px, instead of the live `el.offsetWidth`.
      const CSS_PX_TO_PT = 0.75;
      const printEquivalentWidthPx = usableWidth / CSS_PX_TO_PT;

      // Then shave a further ~2pt off the template's dominant body size
      // (`text-sm`, 14px = 10.5pt at the ratio above) per the user's own
      // follow-up — applied as one uniform scale-down so every size in the
      // document shrinks together rather than just one.
      const BODY_PX = 14;
      const bodyPtAtFullSize = BODY_PX * CSS_PX_TO_PT;
      const extraShrink = (bodyPtAtFullSize - 2) / bodyPtAtFullSize;

      // Clone the document off-screen (not display:none — that would break
      // layout) so we can force it into its "printed" appearance without
      // ever flashing that change on the real, visible page.
      offscreen = document.createElement('div');
      offscreen.setAttribute('data-pdf-export-root', '');
      offscreen.style.position = 'fixed';
      offscreen.style.top = '0';
      offscreen.style.left = '-10000px';
      offscreen.style.width = `${printEquivalentWidthPx}px`;
      offscreen.style.pointerEvents = 'none';
      const clone = el.cloneNode(true) as HTMLElement;
      offscreen.appendChild(clone);
      document.body.appendChild(offscreen);

      styleTag = document.createElement('style');
      styleTag.textContent = collectScopedPrintCss(document, '[data-pdf-export-root]');
      document.head.appendChild(styleTag);

      const canvas = await htmlToImage.toCanvas(clone, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        cacheBust: true,
      });
      const imgData = canvas.toDataURL('image/png');

      const imgWidth = usableWidth * extraShrink;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      // Center the (now slightly narrower than usableWidth) image in the
      // margin box rather than hugging the left margin.
      const imgX = marginSide + (usableWidth - imgWidth) / 2;

      // Tile the (possibly page-spanning) image across as many pages as
      // needed, each time shifting it up by one page's worth of usable
      // height so the right slice lands inside that page's margin box.
      let consumed = 0;
      pdf.addImage(imgData, 'PNG', imgX, marginTop - consumed, imgWidth, imgHeight);
      consumed += usableHeight;
      while (consumed < imgHeight) {
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', imgX, marginTop - consumed, imgWidth, imgHeight);
        consumed += usableHeight;
      }

      pdf.save(`${fileName}.pdf`);
    } catch (e: any) {
      setError(e?.message ?? 'Could not generate PDF.');
    } finally {
      offscreen?.remove();
      styleTag?.remove();
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
