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
}: {
  copies: number;
  children: React.ReactNode;
}) {
  if (copies <= 1) return <>{children}</>;

  return (
    <>
      {Array.from({ length: copies }).map((_, i) => (
        <div key={i} className={i === 0 ? '' : 'hidden print:block print:break-before-page'}>
          {children}
        </div>
      ))}
    </>
  );
}
