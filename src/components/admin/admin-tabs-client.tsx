'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

type TabGroup = { heading: string; tabs: { key: string; label: string }[] };

/**
 * Renders the Admin Settings tab strip + the active panel, entirely
 * client-side. Every panel is built once, server-side, in admin/page.tsx
 * (one DB read for settings/tax rates, not one per tab) and handed down
 * as a map of already-rendered React nodes keyed by tab. Switching tabs
 * here is a local state update — no navigation, no re-fetch, no full-page
 * reload — so it's instant instead of the multi-second round trip a
 * `<Link href="/admin?tab=...">` per tab used to cause. The URL is kept in
 * sync via a non-blocking router.replace purely for bookmarking/sharing.
 */
export default function AdminTabsClient({
  tabGroups,
  initialTab,
  panels,
}: {
  tabGroups: TabGroup[];
  initialTab: string;
  panels: Record<string, ReactNode>;
}) {
  const router = useRouter();
  const [tab, setTab] = useState(initialTab);

  function selectTab(key: string) {
    setTab(key);
    router.replace(`/admin?tab=${key}`, { scroll: false });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {tabGroups.map((group) => (
          <div key={group.heading}>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{group.heading}</p>
            <div className="flex flex-wrap gap-1 border-b border-slate-200 pb-1">
              {group.tabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => selectTab(t.key)}
                  className={`rounded-t-lg px-3 py-2 text-sm font-medium transition-colors ${
                    tab === t.key ? 'border-b-2 border-brand-600 text-brand-700' : 'text-slate-500 hover:text-ink-800'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {panels[tab] ?? null}
    </div>
  );
}
