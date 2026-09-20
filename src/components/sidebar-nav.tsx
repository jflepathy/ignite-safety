'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { PINNED_NAV, NAV_GROUPS, type NavGroup } from '@/lib/nav-config';

export default function SidebarNav({ isAdmin, moduleVisibility }: { isAdmin: boolean; moduleVisibility: Record<string, boolean> }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ billing: true });

  const groups = NAV_GROUPS.filter((g) => {
    if (g.adminOnly && !isAdmin) return false;
    return moduleVisibility[g.key] !== false;
  });

  const pinnedItems = PINNED_NAV.filter((item) => {
    const key = item.href.startsWith('/outreach') ? 'outreach' : item.href === '/work-orders' ? 'workOrders' : null;
    return !key || moduleVisibility[key] !== false;
  });

  function toggle(key: string) {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  // Several nav hrefs can legitimately match the same URL at once — a
  // parent link like "/outreach" is a path-prefix of its own child
  // "/outreach/requests", and tab links like "/billing?tab=invoices" share
  // a pathname with their group's plain "/billing" landing link. Comparing
  // each href in isolation (the previous implementation) lit up every one
  // of those simultaneously — e.g. Overview + Invoices + Estimates all
  // highlighted together, or Outreach + Servicing Requests both highlighted
  // — which is exactly the "highlight stuck on the previous item" bug.
  // Instead, score every href in the sidebar and let only the single most
  // specific match win: an exact query-param match always beats a bare
  // path match, and among path-only matches the longer (more specific)
  // path wins.
  function scoreHref(href: string): number {
    const [path, query] = href.split('?');
    const pathMatches = pathname === path || (path !== '/' && pathname.startsWith(path + '/'));
    if (!pathMatches) return -1;
    if (!query) return path.length;
    const hrefParams = new URLSearchParams(query);
    const paramsMatch = Array.from(hrefParams.entries()).every(([k, v]) => searchParams.get(k) === v);
    return paramsMatch ? path.length + 10_000 : -1;
  }

  const winningHref = useMemo(() => {
    const allHrefs = [...pinnedItems.map((i) => i.href), ...groups.flatMap((g) => g.items.map((i) => i.href))];
    let best: string | null = null;
    let bestScore = -1;
    for (const href of allHrefs) {
      const score = scoreHref(href);
      if (score > bestScore) {
        bestScore = score;
        best = href;
      }
    }
    return best;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams, pinnedItems, groups]);

  const isActive = (href: string) => href === winningHref;

  return (
    <nav className="space-y-4">
      <div className="space-y-1">
        {pinnedItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive(item.href) ? 'bg-brand-600 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'
            )}
          >
            <span aria-hidden>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </div>

      <div className="space-y-1 border-t border-white/10 pt-3">
        {groups.map((group) => (
          <GroupBlock key={group.key} group={group} open={openGroups[group.key] ?? false} onToggle={() => toggle(group.key)} isActive={isActive} />
        ))}
      </div>
    </nav>
  );
}

function GroupBlock({
  group,
  open,
  onToggle,
  isActive,
}: {
  group: NavGroup;
  open: boolean;
  onToggle: () => void;
  isActive: (href: string) => boolean;
}) {
  const hasActiveChild = group.items.some((i) => isActive(i.href));
  return (
    <div>
      <button
        onClick={onToggle}
        className={cn(
          'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors',
          hasActiveChild ? 'text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'
        )}
      >
        <span className="flex items-center gap-3">
          <span aria-hidden>{group.icon}</span>
          {group.label}
        </span>
        <span className={cn('text-xs transition-transform', open || hasActiveChild ? 'rotate-90' : '')}>›</span>
      </button>
      {(open || hasActiveChild) && (
        <div className="ml-8 mt-0.5 space-y-0.5 border-l border-white/10 pl-3">
          {group.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'block rounded-md px-2 py-1.5 text-sm transition-colors',
                isActive(item.href) ? 'bg-white/15 text-white' : 'text-slate-400 hover:bg-white/10 hover:text-white'
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
