export default function TechnicianLoading() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-24 animate-pulse rounded-xl border border-slate-200 bg-white p-4">
          <div className="h-4 w-32 rounded bg-slate-200" />
          <div className="mt-2 h-3 w-48 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}
