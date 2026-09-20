# Ignite Safety — Servicing, Scheduling & Accounting Platform

A production-oriented web application for a fire safety & life-saving equipment
servicing business. Combines a full QuickBooks Online–style invoicing/accounting
system (standalone — no third-party QuickBooks API sync) with a predictive
servicing outreach & scheduling platform, digital work orders, a mobile-friendly
technician POS, and a dynamic, no-code Admin Settings matrix.

## Tech Stack

- **Next.js 14 (App Router) + TypeScript** — UI, server components, API routes
- **Tailwind CSS** — styling
- **PostgreSQL** (Supabase-compatible) + **Prisma ORM** — data layer
- **NextAuth (Credentials provider, JWT sessions)** — authentication
- **Zod** — API input validation
- **signature_pad** — on-device customer sign-off capture
- **date-fns** — date math for service-cycle predictions

No third-party QuickBooks API integration — accounting is fully self-contained.

## Session 3 (2026-09-17) — what changed since the last delivery

The sections below (Navigation & Modules, Data Model, Delivery tiers, etc.)
describe the Phase 1/2 state. This pass added a large core-fixes +
feature tier on top of that, summarized here so it isn't lost in the
older text below:

- **Core fixes:** the global print pipeline (`.print-area` / `@media print`
  CSS — previously no page had print styling at all), the Feedback & AI
  admin section fully removed, the admin-settings toggle-button
  unresponsiveness bug (root cause: raw Prisma `Decimal` props crossing the
  Server→Client Component boundary, breaking hydration — see
  `src/lib/serialize.ts`), and consistent `.row-selectable`/`.is-selected`
  table-row highlighting.
- **Admin:** in-app Backup & Restore (JSON export/import across every
  model), granular per-user module-level permission overrides layered on
  top of the 3-role system (JWT-embedded deny-list, enforced at the Edge in
  `middleware.ts`), and a Multi-Currency Engine (daily FX auto-refresh via
  `frankfurter.app` + Vercel Cron, with manual override/rate-locking) — this
  supersedes the "Multi-currency conversion" item previously listed under
  "out of scope" below.
- **Products & Inventory:** explicit Inventory-vs-Service item
  categorization, auto-incrementing **and** manual SKU entry, and bulk
  CSV/Excel import/export for the product catalog.
- **Sales/CRM/Accounting:** a dedicated Customer `district` field, Sales
  Orders hidden from navigation (data/API intentionally left intact),
  a print-confirmation prompt after saving an Invoice/Estimate/Sales
  Receipt, the invoice/estimate/sales-receipt print layout aligned to the
  company's actual PDF template, Expense entries now require a real Chart
  of Accounts link (with optional Supplier mapping), and the Sales/Expense
  settings screens were re-grouped into logical categories.
- **Servicing Requests & Smart Scheduling:** the New Servicing Request
  wizard was rebuilt — searchable client dropdown with contact
  auto-populate, inline new-customer creation, Region/District selection,
  an explicit Building/House Name field, +/- counters per equipment
  category, and a "Check Availability & Schedule" flow that opens a Smart
  Scheduling confirmation modal and auto-converts straight to a Work Order.
  This also fixed the underlying bug where new Servicing Requests never
  became Work Orders (the conversion endpoint existed but nothing called
  it — now wired end-to-end, plus a visible "Servicing Requests Queue" on
  the Outreach dashboard as a manual fallback).
- **Mobile POS:** the Technician job screen was rebuilt as a full-screen
  digital work order — header with client/location/WO#/contact/date, a
  left panel of item cards with +/- steppers and a running "Total Units
  Affected" counter, an "Invoice # (if issued)" field, full-screen signature
  capture, a right-panel Quick-Tap equipment grid plus custom-item entry,
  and a Workshop Actions grid (Rust Treatment, Pressurize, Valve Change).
- **Employees & Time Tracking:** individual standard weekly hours,
  employment type and contract-end-date fields, and pay now defaults to a
  monthly rate structure (`Employee.payType` default changed from `HOURLY`
  to `MONTHLY`; `HOURLY`/`SALARY` remain available per employee).
- **QA pass (this session):** verified clean `tsc --noEmit` and
  `npm run build`; verified every API route enforces `requireRole()`
  (including Technician-own-work-order scoping on every read/write, not
  just the list query); verified financial-precision arithmetic in
  `src/lib/money.ts` against a battery of discount/tax-mode/many-line/
  floating-point edge cases; and verified all 7 migrations plus
  `prisma/seed.ts` run cleanly against a from-scratch database with no
  collisions.
- **`ARCHITECTURE_ROADMAP.md`** (new file, project root) — a forward-looking
  plan (not built) for five future capabilities: Asset Serialization &
  Barcode Scanning, Compliance Certificate Generation, GPS Location
  Validation, Automated Compliance Scheduling, and Performance-Linked
  Payroll.

## Navigation & Modules

The sidebar has two parts: the Ignite-specific workflow pinned at the top
(**Outreach**, **Work Orders**), and the QuickBooks-style shell below it,
each section toggleable per-account from Admin → UI Customization:

- **Accounting** — Chart of Accounts, Reconcile, Bank Deposits, Transfers, Journal Entries, Audit Log
- **Expenses & Pay Bills** — Expense Transactions, Suppliers, Bills (with Pay), Purchase Orders
- **Sales & Get Paid** — Invoices, Estimates, Sales Receipts, Refund Receipts, Credit Notes, Customers, Products & Services, Reports (Sales Orders was removed from navigation in Session 3 — the module, data and API remain fully intact, just unlinked)
- **Customer Hub** — Customers, Leads, Opportunities (pipeline)
- **Team** — Employees, Time Tracking
- **Inventory** — Stock levels, Adjustments
- **Tax** — Tax Center (tax rates, VAT collected)
- **Marketing** — reserved, "coming soon"
- **Settings** *(Admin only)* — the full settings matrix, Lists & Tools, Users

A global **+ Create** menu (top-right header) gives one-click access to every
document type, grouped as Customers/Sales, Suppliers/Expenses, Team/Payroll,
and Other/General — matching the quick-create pattern from the spec.

## Project Structure

```
prisma/
  schema.prisma          Full data model (60+ models — see "Data Model" below)
  seed.ts                 Production scaffolding only: login accounts, chart
                           of accounts, tax rates, equipment/service catalog,
                           tags, and real company settings (from the
                           Certificate of Registration / TIN letter). No demo
                           customers, invoices, work orders or employees.
  data/clients.json       Ignite Safety's real historical client roster
                           (796 customers), deduplicated/merged from the
                           company's own servicing & invoice records.
  import-clients.ts       Re-runnable script that loads data/clients.json
                           into the Customer table (idempotent — matches on
                           displayName, so it's safe to run again).
  assets/default-logos.ts Base64 data-URIs for the two Ignite Safety logo
                           variants seed.ts writes into AppSettings.logoUrl
                           (documents/forms) and faviconUrl (browser tab).
src/
  app/
    login/                 Public sign-in page
    share/invoice/[token]/ Public, unauthenticated invoice view (share links)
    (app)/                 Admin + Sales shell (sidebar layout, RBAC-gated)
      outreach/             Module B: predictive outreach dashboard (KPIs + client table)
      work-orders/           Module C: active work orders dashboard & detail
      billing/               Invoices, sales orders, sales/refund receipts, credit notes,
                              receive payment, reports
      customers/             CRM / phone directory
      customer-hub/           Leads, Opportunities
      expenses/               Expense transactions, suppliers, bills, purchase orders
      accounting/             Chart of accounts, reconcile, deposits, transfers,
                              journal entries, audit log
      team/                   Employees, time tracking
      inventory/              Stock levels, adjustments
      tax/                    Tax center
      marketing/              Placeholder
      admin/                 Module D: settings matrix, catalog, lists & tools, users
    technician/            Mobile-first Technician POS (separate layout)
    api/                   All REST route handlers (see below)
  components/              Reusable UI, organized by module
  lib/                     auth, prisma client, money/tax calc, scheduling,
                            numbering, RBAC helpers, nav config
  middleware.ts            Route-level RBAC enforcement
```

### API Routes (all under `src/app/api`)

| Area | Routes |
|---|---|
| Auth | `POST /api/auth/[...nextauth]` (NextAuth) |
| Customers / Equipment | `GET/POST /api/customers`, `GET/POST /api/equipment` |
| Shop items / Tax rates | `GET/POST /api/shop-items`, `PATCH/DELETE /api/shop-items/:id`, `GET/POST /api/tax-rates` |
| Invoices | `GET/POST /api/invoices`, `GET/PATCH/DELETE /api/invoices/:id`, `POST /api/invoices/:id/payments` |
| Estimates / Credit notes | `GET/POST /api/estimates`, `POST /api/estimates/:id/convert`, `GET/POST /api/credit-notes` |
| Sales Orders / Receipts | `GET/POST /api/sales-orders`, `GET/POST /api/sales-receipts`, `GET/POST /api/refund-receipts` |
| Suppliers / Bills / POs | `GET/POST /api/suppliers`, `GET/POST /api/bills`, `POST /api/bills/:id/payments`, `GET/POST /api/purchase-orders` |
| Expenses | `GET/POST /api/expenses` |
| Leads / Opportunities | `GET/POST /api/leads`, `PATCH /api/leads/:id`, `GET/POST /api/opportunities`, `PATCH /api/opportunities/:id` |
| Employees / Time | `GET/POST /api/employees`, `GET/POST /api/time-activities` |
| Accounting | `GET/POST /api/accounts`, `GET /api/bank-accounts`, `GET/POST /api/deposits`, `GET/POST /api/transfers`, `GET/POST /api/journal-entries` (rejects unbalanced entries), `GET /api/audit-log` |
| Inventory | `GET/POST /api/inventory-adjustments` |
| Attachments | `GET/POST /api/attachments`, `DELETE /api/attachments/:id` (polymorphic, data-URL storage) |
| Reports | `GET /api/reports/ar-aging`, `/income-expense`, `/sales-tax` |
| Outreach | `GET /api/outreach` (computed predictive list) |
| Service requests | `GET/POST /api/service-requests`, `GET /api/service-requests/availability`, `POST /api/service-requests/:id/convert` |
| Work orders | `GET/POST /api/work-orders`, `GET/PATCH /api/work-orders/:id`, `POST /api/work-orders/:id/inspection-items`, `POST /api/work-orders/:id/complete` |
| Settings | `GET/PATCH /api/settings` |
| Users | `GET/POST /api/users`, `PATCH /api/users/:id` |

Every handler enforces RBAC server-side via `requireRole()` — the frontend
route gating (middleware.ts) is a UX convenience, not the security boundary.

## Data Model Highlights

See `prisma/schema.prisma` for the full schema. Key entities:

- **User** (role: ADMIN / SALES / TECHNICIAN), **Customer**, **CustomerSite**
- **Equipment** + **EquipmentTypeCatalog** (service intervals, hydrostatic flag)
- **ShopItem** (pricing catalog, inventory tracking, income/expense account mapping), **TaxRate**
- **ServiceRequest** + **ServiceRequestEquipmentCount** (outreach wizard output)
- **DailyCapacityOverride** (per-date team capacity override)
- **WorkOrder** + **WorkOrderInspectionItem** (digital work order / POS)
- **Invoice** / **InvoiceLineItem**, **Estimate** / **EstimateLineItem**,
  **CreditNote** / **CreditNoteLineItem**, **Payment**, **Expense** — invoices
  and estimates carry `taxInclusive`, `customerMessage`, `customerPaymentOptions`,
  `shareToken` (direct share link) and `isRecurring`/`recurringTemplateId`
- **SalesOrder**, **SalesReceipt**, **RefundReceipt** (+ their line items)
- **Account** (Chart of Accounts, self-referencing hierarchy), **JournalEntry** /
  **JournalLine** (double-entry, server-validated balance), **BankAccount**,
  **BankTransaction**, **Deposit**, **AccountTransfer**
- **Supplier**, **Bill** / **BillLineItem**, **SupplierPayment**,
  **PurchaseOrder** / **PurchaseOrderLineItem**, **SupplierCredit**
- **Lead**, **Opportunity** (CRM pipeline), **Employee**, **TimeActivity**
- **Attachment** (polymorphic — `entityType`/`entityId`), **Tag** / **TaggedEntity**,
  **CustomField**, **RecurringTemplate**, **InventoryAdjustment**
- **AppSettings** — singleton row backing the entire Module D settings matrix:
  company profile, usage limits, sales settings, progress invoicing, messages
  & reminders, customer feedback & AI toggles, expenses settings, time
  tracking, advanced/financial preferences (accrual vs cash, fiscal/tax year,
  multi-currency, automation rules), document numbering (13 document types),
  scheduling/dispatch, tax/financial defaults, sidebar module visibility
- **AuditLog** — records settings changes & invoice creation

## Local Setup

```bash
npm install
cp .env.example .env       # then edit DATABASE_URL / DIRECT_URL / NEXTAUTH_SECRET

npx prisma migrate dev     # creates tables
npm run db:seed            # production scaffolding + 4 login accounts
npx tsx prisma/import-clients.ts   # imports the real 796-customer roster

npm run dev                # http://localhost:3000
```

Login accounts (password: `password123` — change this before going live):

| Role | Email |
|---|---|
| Admin | admin@ignitesafety.sc |
| Sales | sales@ignitesafety.sc |
| Technician | tech@ignitesafety.sc |
| Technician | tech2@ignitesafety.sc |

### Real client data import

`prisma/data/clients.json` was built from Ignite Safety's own servicing
records (2022–2026 invoice/sales exports, the client contact register, and a
business phone directory used to fill in missing numbers), deduplicated with
a fuzzy name-matching pass. To regenerate it from a fresh batch of exports,
see the note at the top of `prisma/import-clients.ts`. Running the script
again is always safe — it matches existing customers by name and updates
them rather than creating duplicates.

## Deploying on Supabase + Vercel (recommended path)

1. Create a Supabase project. Copy the **connection pooling** URI (port 6543)
   into `DATABASE_URL`, and the **direct connection** URI (port 5432) into
   `DIRECT_URL` — Prisma migrations need the direct connection.
2. `npx prisma migrate deploy` against that database (or run it as a Vercel
   build step / GitHub Action).
3. Run `npm run db:seed` once against production — it sets up the real
   company profile (from the incorporation documents), chart of accounts,
   tax rates, equipment/service catalog and login accounts. No demo business
   data is created. Then run `npx tsx prisma/import-clients.ts` to load the
   real client roster.
4. Deploy the Next.js app to Vercel (or any Node host). Set `DATABASE_URL`,
   `DIRECT_URL`, `NEXTAUTH_URL` (your production URL) and a strong
   `NEXTAUTH_SECRET` (`openssl rand -base64 32`) as environment variables.
5. `password123` on the seeded accounts is for local development only —
   before going live, create your real production users with their own
   passwords via `POST /api/users` (as an Admin), then deactivate the
   seeded ones from Settings > Users (there's no in-app password-change
   yet, so a seeded account keeps its seed password until deactivated).

## How the requested features map to the code

- **Manual billing (never auto-fired):** invoices are only ever created by a
  POST from `InvoiceForm` (`/billing/invoices/new`) or by converting an
  estimate/completed work order — there is no scheduled job or webhook that
  creates an invoice. This holds for every new document type too (bills,
  sales orders, receipts, etc.) — all are explicit user actions.
- **Tax/discount auto-calc, inclusive or exclusive:**
  `src/lib/money.ts#computeDocumentTotals(items, globalDiscountPercent, inclusive)`
  — pure function, applies item discount → global discount → tax; in
  inclusive mode tax is backed out of the entered price rather than added on
  top. Used identically by the client-side live preview and every
  server-side create route so totals can never drift.
- **Invoice document workflow:** manual creation, customer linking, terms
  presets, due dates, tax inclusive/exclusive toggle, SKU-labelled line
  items, discount %, per-line tax, customer payment options, a message to
  the customer (separate from internal notes), file attachments (stored as
  data-URLs on the polymorphic `Attachment` model), recurring setup (saves a
  `RecurringTemplate` — automatic regeneration on schedule is the one
  Tier 3 item here), a direct unauthenticated share link
  (`/share/invoice/[token]`), and print/export via the browser's print
  dialog (styled with print CSS).
- **Predictive outreach:** `src/lib/scheduling.ts#computeOutreachList` derives
  next-due dates from `lastServiceDate + intervalMonths` for every equipment
  record; the Outreach dashboard aggregates this to one row per client (with
  contact info, address, an equipment-type profile, and the soonest due
  date) and surfaces KPI cards for Total Pipeline, Overdue Service, Due This
  Month/Soon, and Upcoming Planned (service requests already scheduled).
- **Capacity-aware scheduling:** `checkDateAvailability()` compares the
  admin-configured `dailyTeamCapacity` (or a per-date override) against
  requests already booked that day; the New Servicing Request wizard calls
  this live as the user picks a date.
- **Active Work Orders dashboard:** auto WO numbers, a status breakdown
  (Past Due / Pending / Scheduled / In Progress / Completed — Past Due is
  derived live from the scheduled date rather than requiring a cron job),
  and a one-click "Open in POS" action into the technician mobile flow.
- **Work order → invoice, one click:** the Work Order detail page and the
  Billing dashboard both link completed, unbilled work orders straight to a
  pre-filled `New Invoice` form.
- **No-code settings matrix:** everything in Module D reads/writes the single
  `AppSettings` row via `/api/settings`; the sidebar itself reads
  `uiModules` on every page load, so toggling a module in Settings hides it
  immediately for Sales/Admin users. The Admin page is organized into the
  same category structure as the spec (Company & Account, Sales Settings,
  Messages & Reminders, Feedback & AI, Expenses Settings, Time Tracking,
  Advanced & Financial, Numbering, Scheduling & Dispatch, Tax & Financial,
  Lists & Tools, UI Customization, Users).
- **RBAC:** `middleware.ts` blocks page navigation by role and redirects to
  each role's home; every API route additionally calls `requireRole()` so
  the restriction holds even if someone calls the API directly. Technicians
  are further scoped to only their own assigned work orders, both in the
  list query and via an ownership check on every mutation.

## Delivery tiers — what's fully built vs. scaffolded vs. placeholder

Given the scope of this request, the build was done in three honest tiers:

**Tier 1 — full working logic** (the pieces explicitly requested with code,
plus the core Ignite-specific workflow): Outreach dashboard, Work Orders
dashboard, the Invoicing document workflow (tax modes, terms, messaging,
payment options, attachments, recurring template, share link), and the full
Admin Settings matrix. Every field in these is wired to a real database
column and a real save/read path — nothing here is cosmetic.

**Tier 2 — real CRUD + schema** (standard QuickBooks-style modules): Chart
of Accounts, Suppliers/Bills/Purchase Orders (with bill payment tracking),
Sales Orders/Sales Receipts/Refund Receipts/Credit Notes, Products &
Inventory (stock levels + adjustments that actually move `quantityOnHand`),
Bank Deposits/Transfers (that actually move account balances), Journal
Entries (server-rejects unbalanced entries), CRM Leads/Opportunities (with a
pipeline value KPI), Employees/Time Tracking, and the Tax Center (tax rates
+ real VAT-collected totals from invoice data). These have list + create
pages, full API routes with RBAC and Zod validation, and were smoke-tested
end-to-end against a live database (see below) — they're not stubs, but the
UI is intentionally simpler than the Tier 1 pages (no bulk actions, no
inline editing beyond a status dropdown).

**Tier 3 — clearly-labelled placeholders** for deep, long-tail items that
would each be their own project: bank statement import & auto-reconciliation
(the Reconcile page shows real transactions and balances but matching is
manual), a marketing/email campaign builder, budgeting, transaction
reclassify, CSV import/export, screen-sharing support sessions, and
automatic regeneration of recurring invoices on schedule. Every one of these
is visible in the UI (under Lists & Tools, Marketing, or inline on the
relevant page) with a plain "coming soon" label rather than a broken link or
a silent no-op.

### Smoke-tested end-to-end against a live Postgres database

Beyond `npx tsc --noEmit` and `npm run build` passing clean, the following
flows were exercised with a real logged-in session (not just unit-level):
supplier + bill creation, partial bill payment (status transitions
OPEN → PARTIAL), purchase order creation, journal entry balance validation
(both the rejection of an unbalanced entry and acceptance of a balanced
one), bank deposit (verified it increments the bank account balance), sales
receipt tax calculation, invoice creation with tax-inclusive pricing
(verified the tax-backed-out math), a recurring template being created,
the public share link rendering without auth, file attachment upload, lead
status and opportunity stage updates, and RBAC (a Sales-role user correctly
blocked with 403 from an Admin-only API route and redirected away from
`/admin` by middleware). A seed-data bug this testing caught — the seeded
Bill/Purchase Order used hardcoded numbers without advancing their sequence
counters, which collided with the first real one created through the UI —
was fixed in `prisma/seed.ts`.

## What's intentionally out of scope for this pass

- PDF export of invoices (currently print-to-PDF via the browser print
  dialog, styled with print CSS on the invoice detail page)
- Email delivery of invoices/estimates, and actually sending the payment
  reminder schedule configured in Messages & Reminders
- Automatic regeneration of recurring invoices on schedule (the template is
  saved and visible; a background job to fire it is not built)
- Soft-delete recovery UI for the "Recycle Bin" concept (the data model
  already supports it via `deletedAt` columns)
- Bank statement import & automatic transaction matching (Reconcile is
  currently a live transaction list + manual state, not an import pipeline)
- Everything listed under "Tier 3" above (except multi-currency and CSV
  import/export, both of which were built in Session 3 — see above)
