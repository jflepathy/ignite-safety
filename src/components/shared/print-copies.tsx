/**
 * Repeats its children N times inside a .print-area so the printed output
 * comes out as N physical copies (e.g. 2 copies of an Invoice/Sales Receipt,
 * 1 of an Estimate) — browser print dialogs don't expose a scriptable copy
 * count, so this duplicates the document in the DOM instead, one per page
 * (Session 10). Only the first copy is ever visible on screen; the rest
 * exist purely for print output.
 */
export default function PrintCopies({
  copies,
  children,
  id,
}: {
  copies: number;
  children: React.ReactNode;
  /** Applied to the single always-visible copy (the first one) so a
   * DownloadPdfButton elsewhere on the page can target it directly and
   * export just that one copy, not the print-only duplicates (Session 11). */
  id?: string;
}) {
  if (copies <= 1) return <div id={id}>{children}</div>;

  return (
    <>
      {Array.from({ length: copies }).map((_, i) => (
        <div key={i} id={i === 0 ? id : undefined} className={i === 0 ? '' : 'hidden print:block print:break-before-page'}>
          {children}
        </div>
      ))}
    </>
  );
}
