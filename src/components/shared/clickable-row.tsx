'use client';

import { useRouter } from 'next/navigation';

/**
 * A <tr> that navigates to `href` on click and shows real selection
 * highlighting while pressed/focused, using the `.row-selectable` /
 * `.is-selected` utility classes (see globals.css). Previously most list
 * tables in the app only had a `hover:bg-slate-50` class with no click
 * behavior behind it at all — visually inviting a click that did nothing,
 * which is what read as "selection highlighting that fails to render."
 */
export default function ClickableRow({
  href,
  children,
  className = '',
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();
  return (
    <tr
      className={`row-selectable border-b border-slate-50 ${className}`}
      onClick={() => router.push(href)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') router.push(href);
      }}
      tabIndex={0}
      role="link"
    >
      {children}
    </tr>
  );
}
