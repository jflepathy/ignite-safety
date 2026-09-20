/**
 * Instant pending UI for every route under the authenticated app shell.
 * Next.js renders this immediately on navigation while the new page's
 * server component (data fetch + render) is still in flight, instead of
 * leaving the previous page's content sitting on screen with no feedback
 * until the new one is ready. Paired with the top progress bar in
 * layout.tsx (NextTopLoader) for the sidebar/header, which stay mounted.
 */
export default function AppLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <div className="h-7 w-48 animate-pulse rounded-md bg-slate-200" />
        <div className="h-4 w-72 animate-pulse rounded-md bg-slate-100" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card h-24 animate-pulse p-4">
            <div className="h-3 w-24 rounded bg-slate-200" />
            <div className="mt-3 h-6 w-32 rounded bg-slate-100" />
          </div>
        ))}
      </div>
      <div className="card animate-pulse p-6">
        <div className="mb-4 h-4 w-40 rounded bg-slate-200" />
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-4 w-full rounded bg-slate-100" />
          ))}
        </div>
      </div>
    </div>
  );
}
