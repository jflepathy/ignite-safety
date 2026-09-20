'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

/** Drop into any print-capable detail page. When the page is reached with
 * ?print=1 (set by a form's inline "Save & Print" button), automatically
 * opens the browser print dialog once the page has rendered. */
export default function PrintOnLoad() {
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams.get('print') === '1') {
      const t = setTimeout(() => window.print(), 300);
      return () => clearTimeout(t);
    }
  }, [searchParams]);
  return null;
}
