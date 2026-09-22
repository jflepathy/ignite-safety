'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import SignOutButton from '@/components/sign-out-button';
import SidebarNav from '@/components/sidebar-nav';
import CreateMenu from '@/components/create-menu';

/**
 * The app's sidebar + header shell. Previously a fixed `w-64` <aside> that
 * was always in the document flow — fine on desktop, but on a phone or
 * portrait tablet it left barely 100px for actual content next to a
 * permanently-visible 256px sidebar, with no way to collapse it. This
 * makes the sidebar an off-canvas drawer below the `lg` breakpoint
 * (roughly phones + portrait tablets): closed by default, opened with a
 * hamburger button in the header, closes on an overlay tap or on
 * navigating to a new page. At `lg` and up it behaves exactly as before —
 * always-visible, in-flow, no overlay.
 */
export default function AppShell({
  isAdmin,
  role,
  email,
  companyName,
  logoUrl,
  moduleVisibility,
  children,
}: {
  isAdmin: boolean;
  role: string;
  email: string | null | undefined;
  companyName: string;
  logoUrl: string | null | undefined;
  moduleVisibility: Record<string, boolean>;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer automatically whenever the route changes (e.g. after
  // tapping a nav link), so it doesn't stay open over the next page.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-screen">
      {open && (
        <div
          className="app-shell-chrome fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={`app-shell-chrome fixed inset-y-0 left-0 z-40 flex w-64 flex-shrink-0 -translate-x-full flex-col overflow-y-auto bg-ink-900 px-4 py-6 transition-transform duration-200 ease-out lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : ''
        }`}
      >
        <div className="mb-6 flex items-center gap-2 px-2">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-9 w-9 flex-shrink-0 rounded-lg bg-white object-contain p-1" />
          ) : (
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-brand-600 font-bold text-white">
              IS
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{companyName}</p>
            <p className="text-xs text-slate-400">{role}</p>
          </div>
          <button
            type="button"
            className="ml-auto rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>
        <div className="flex-1">
          <SidebarNav isAdmin={isAdmin} moduleVisibility={moduleVisibility} />
        </div>
        <div className="space-y-2 border-t border-white/10 pt-4">
          <p className="truncate px-2 text-xs text-slate-400">{email}</p>
          <SignOutButton />
        </div>
      </aside>
      <div className="flex flex-1 flex-col overflow-x-hidden">
        <header className="app-shell-chrome flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
          <button
            type="button"
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div className="flex-1" />
          <CreateMenu />
        </header>
        <main className="flex-1 overflow-x-hidden">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
