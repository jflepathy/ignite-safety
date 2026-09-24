import { redirect } from 'next/navigation';

// Sales Receipts used to have their own standalone list page here. As of
// this change they're shown together with Invoices in Billing > Overview's
// "Invoice & Sales Receipts" tab (the two share one numbering sequence —
// see billing/page.tsx), so this route just forwards any old bookmark or
// link to that tab instead of 404ing. The create/detail/edit pages under
// /billing/sales-receipts/* are unaffected and still live at their own
// paths.
export default function SalesReceiptsListRedirect() {
  redirect('/billing?tab=documents');
}
