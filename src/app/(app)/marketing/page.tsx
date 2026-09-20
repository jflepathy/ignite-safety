// Tier 3 placeholder: digital/email marketing tools are a large,
// long-tail integration surface (campaign builder, list segmentation,
// email delivery, engagement tracking) and are explicitly out of scope
// for this delivery. This page reserves the route and nav slot.
export default function MarketingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">Marketing</h1>
        <p className="text-sm text-slate-500">Digital and email marketing tools.</p>
      </div>
      <div className="card border-dashed p-12 text-center">
        <p className="text-lg font-medium text-ink-900">Coming soon</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
          Campaign builder, customer list segmentation, email templates and engagement tracking will live here. For now, use the
          Customer Hub to manage your leads and outreach manually.
        </p>
      </div>
    </div>
  );
}
