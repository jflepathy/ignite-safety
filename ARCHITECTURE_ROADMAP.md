# Ignite Safety — Architecture Roadmap

This document is forward-looking. Nothing below has been built — it's an
engineering plan for five capabilities identified as strategic extensions to
the platform, written against the actual schema and modules that exist today
(see `ARCHITECTURE_OVERVIEW` in the project notes, or `README.md`, for what's
already shipped). Each section covers the target capability, how it plugs
into the current data model and modules, the new work required, and an
honest read on complexity and risk — so these can be scoped as real sprints
when prioritized, rather than re-discovered from scratch.

Suggested build order follows the dependency chain below: Asset Serialization
underpins Compliance Certificates (a cert must reference a specific serialized
unit) and is a light lift on top of the SKU system shipped this session.
GPS Validation and Automated Compliance Scheduling both extend the existing
Smart Scheduling / predictive outreach engine and can proceed in parallel
once serialization lands. Performance-Linked Payroll is the most
organizationally sensitive and least urgent technically — it's listed last
by design.

---

## 1. Asset Serialization & Barcode Scanning

**Goal:** Move from "the customer has 6 fire extinguishers" to "the customer
has these 6 specific serialized units, each with its own service history,"
and let a technician scan instead of hand-type serial numbers in the field.

**Where this plugs in today:** The `Equipment` model already exists
(`category`, `serialNumber`, `lastServiceDate`, customer/site relation) and
`WorkOrderInspectionItem` already has an optional `equipmentId` link plus a
free-text `serialNumber` field captured per visit. The mobile POS
(`pos-client.tsx`) already has a Quick-Tap equipment grid and a custom-item
input. This feature is largely additive, not a rework.

**Proposed approach:**
- Extend `Equipment` with a `barcodeValue String? @unique` (the physical
  barcode/QR payload, distinct from the human-readable `serialNumber`) and
  `assetTag String? @unique` for a printable internal asset tag if the
  customer's own unit has no scannable barcode.
- Add a lightweight `EquipmentEvent` model (equipmentId, workOrderId,
  eventType [SERVICED / REPLACED / DECOMMISSIONED / RELOCATED], notes,
  createdAt) so an asset's full lifecycle is queryable independent of
  work order history — this is what makes "show me this extinguisher's
  entire service history" a single indexed query instead of a scan across
  every historical `WorkOrderInspectionItem`.
- Scanning itself is a browser capability, not a native app: the
  `BarcodeDetector` Web API covers modern Android/Chrome; for broader
  device coverage (older iOS Safari in particular) a JS fallback library
  (`@zxing/browser`, MIT-licensed, no server dependency) decodes from the
  device camera via `getUserMedia`. Both feed into the same POS "Add
  Equipment" flow the Quick-Tap grid already uses — scanning just becomes
  another way to resolve an `Equipment` row instead of tapping a category
  card.
- Reconciliation flow: scanning an unrecognized barcode on an existing
  customer prompts "register new asset" inline (same UX pattern as the
  Servicing Request wizard's inline customer creation built this session),
  rather than blocking the technician.

**New work:** 1 migration, a barcode-decode component wired into the
existing POS equipment panel, a "Print Asset Tags" admin utility (label
sheet PDF, batched by customer or site), and an Equipment detail page for
service-history lookup. No changes to invoicing, scheduling, or RBAC.

**Complexity:** Low-medium. The main variable is camera/scanning reliability
across the technicians' actual devices, which should be piloted with 2-3
real phones before committing to a specific decode library.

---

## 2. Compliance Certificate Generation

**Goal:** After a work order is completed and signed off, generate a
regulator/insurer-facing compliance certificate (PDF) per serviced asset or
per site, not just the internal invoice/work order record.

**Where this plugs in today:** `WorkOrder` already captures
`customerSignedName` / `customerSignatureDataUrl` and a full
`WorkOrderInspectionItem[]` (category, pass/fail, replacement parts,
hydrostatic test data). `InvoiceDocument` already established the
`.print-area` pattern for clean, chrome-free PDF-quality browser printing —
certificate generation is a natural sibling to that component, not a new
subsystem.

**Proposed approach:**
- Add a `certificateNumber String? @unique` and `certificateIssuedAt
  DateTime?` to `WorkOrder` (numbered via the existing `nextDocumentNumber()`
  sequence pattern already used for invoices/estimates/work orders — a
  `certificatePrefix`/`certificateNextSeq` pair on `AppSettings`, same shape
  as every other document-numbering field added this session).
- Build a `CertificateDocument` component analogous to `InvoiceDocument`:
  company header, site/customer details, a per-asset table (category,
  serial/asset tag once serialization lands, result, next-due date), the
  technician's name, and the captured customer signature — rendered through
  the same `.print-area` CSS the printing-bug fix established, so "Print"
  and "Save as PDF" both work with zero new PDF-generation infrastructure.
- Gate generation on work order completion (`status === 'COMPLETED'`) and
  on every inspection item having a definitive `passFail` result — a
  work order with unresolved `NA` results shouldn't be able to issue a
  clean compliance certificate.
- Certificates should be independently re-printable/re-downloadable later
  (e.g., a customer loses their copy) via a dedicated
  `/work-orders/[id]/certificate` route, following the same auth model as
  the existing invoice detail/share-link pages.

**New work:** 1 migration, 1 new document component (reuses `formatMoney`-
adjacent formatting helpers, not money-specific), 1 new page, one numbering
sequence. If a specific regulatory body (Seychelles Fire & Rescue Services
Agency or an insurer) has a mandated certificate layout, that should be
sourced before building the component — this roadmap assumes a generic,
professional layout matching the existing invoice template family.

**Complexity:** Low. This is the most "just build it" item on this list —
it composes almost entirely from patterns already shipped this session.

---

## 3. GPS Location Validation

**Goal:** Confirm a technician was physically at the customer's site when a
work order was started/completed, and flag discrepancies for review.

**Where this plugs in today:** `WorkOrder` has `locationDetails` (free text)
and a `region`/`district` pair; `Customer`/`Site` records don't currently
carry coordinates. The mobile POS already runs in the technician's browser
on their phone, which is the natural place to capture a GPS read.

**Proposed approach:**
- Add `latitude Decimal? @db.Decimal(9,6)` / `longitude Decimal? @db.Decimal(9,6)`
  to `Site` (and `Customer` for customers without a separate Site record),
  captured once via the browser Geolocation API when a site/customer is
  created or edited — a one-time "Set location" action, not something
  captured on every visit.
- Add `checkInLat`/`checkInLng`/`checkInAccuracy` (Decimal, nullable) and
  the same triplet for check-out to `WorkOrder`, captured automatically via
  `navigator.geolocation.getCurrentPosition()` at the moment the technician
  taps "Start" (transition to `IN_PROGRESS`) and "Complete & Sync" in the
  POS — both state transitions already exist as explicit actions, so this
  is an additional side-effect on an existing event, not a new workflow
  step for the technician to remember.
- Validation is a simple haversine-distance check server-side (no external
  geocoding API required) comparing check-in coordinates against the site's
  stored coordinates, with a configurable tolerance radius
  (`AppSettings.gpsToleranceMeters`, default something generous like 150m
  to absorb GPS drift and multi-building sites). Out-of-tolerance visits are
  flagged (`WorkOrder.locationFlagged Boolean`), not blocked — field
  conditions (indoor readings, dense urban blocks) make hard rejection a
  support-ticket generator, not a quality win.
- Flagged work orders surface as a filter on the Work Orders dashboard for
  Admin/Sales review, same pattern as the existing Past Due detection.

**New work:** 1 migration, geolocation capture wired into two existing POS
button handlers, a small haversine utility (~10 lines, no dependency), a
dashboard filter. Requires HTTPS (already true for any real deployment) and
the technician granting browser location permission — worth a short in-app
explainer the first time it's requested, since a bare browser permission
prompt with no context has poor accept rates.

**Complexity:** Medium. The engineering is straightforward; the real risk is
process/trust — field staff should know upfront that location is being
logged and why (compliance/insurance, not surveillance), or this becomes an
HR issue rather than a technical one.

---

## 4. Automated Compliance Scheduling

**Goal:** Move from "the Outreach dashboard shows who's overdue" (built this
session) to the system automatically generating the next Service Request —
or at minimum a reminder task — on a predictable cadence, without a human
having to notice the due date first.

**Where this plugs in today:** `src/lib/scheduling.ts` already computes
predictive next-due dates and daily capacity availability; the Outreach
dashboard already surfaces an aggregated overdue/due-soon table; the
Servicing Request wizard (rebuilt this session) already has a working
"Check Availability & Schedule" → Smart Scheduling → auto-convert-to-Work-
Order pipeline. Automation here means triggering that existing pipeline on
a schedule instead of waiting for a staff member to open the dashboard.

**Proposed approach:**
- Add a `ComplianceSchedulePolicy` model (equipment category → service
  interval in months, e.g., fire extinguishers annually, hose reels
  annually, suppression systems per manufacturer spec) so intervals are
  admin-configurable per category rather than hardcoded — mirrors how
  `TaxRate`/`Account` are already admin-managed reference data.
- A daily Vercel Cron job (same mechanism as the FX-rate refresh cron
  shipped this session — `vercel.json` already has the pattern established)
  scans `Equipment.lastServiceDate` against its category's policy interval
  and, for anything crossing into a configurable lead window (e.g., 30 days
  out), either (a) auto-creates a `ServiceRequest` in `NEW` status for
  staff to confirm/schedule — the safer default, keeping a human in the
  loop before a technician is dispatched — or (b) sends an internal
  notification only, with auto-creation as an opt-in `AppSettings` toggle
  once the business is comfortable with the first mode.
- Reuses the existing `ServiceRequest` → convert → `WorkOrder` pipeline
  entirely; this feature is "what creates the Service Request," not a new
  scheduling engine.
- Customer-facing reminders (SMS/email "your service is due") are
  explicitly out of scope for this phase — they depend on a messaging
  provider decision (Twilio/SendGrid or similar) that's a business/cost
  choice, not an architecture one, and were already flagged as a known gap
  (email delivery) in the current build.

**New work:** 1 migration, 1 cron route (closely mirrors
`/api/admin/exchange-rates/refresh`), an admin screen for policy intervals,
an `AppSettings` toggle for auto-create vs. notify-only.

**Complexity:** Low-medium — almost entirely composition of things already
built. The judgment call is auto-create vs. notify-only as the default, which
is a business decision worth confirming before building, not an engineering
one.

---

## 5. Performance-Linked Payroll

**Goal:** Tie part of an employee's pay to measurable output — jobs
completed, on-time completion rate, upsell/attach-rate on service visits —
on top of the monthly base-pay structure shipped this session.

**Where this plugs in today:** `Employee.payType` now defaults to
`MONTHLY` with a flat `payRate`; `TimeActivity` links hours to a
`WorkOrder`/customer; `WorkOrder` has full lifecycle timestamps
(`scheduledDate`, `startedAt`, `completedAt`) and is already
technician-scoped end-to-end (server + client, verified in this session's
QA pass). The raw signal this feature needs — who completed what, on time,
with what line items — already exists; nothing performance-linked is
currently computed from it.

**Proposed approach — deliberately the most conservative on this list:**
- Add a `PerformanceBonusRule` model (metric type, threshold, bonus
  amount or percent, active date range) as admin-configured reference data,
  not hardcoded logic — pay-policy details (what counts as "on time," what
  the bonus curve looks like) belong to the business, not the codebase, and
  will change over time.
- A monthly payroll-close report (not an automatic pay adjustment) computes,
  per technician: work orders completed, on-time-completion rate (`completedAt`
  vs `scheduledDate` + configurable grace window), and total billable hours
  from `TimeActivity`, then applies the active `PerformanceBonusRule`s to
  produce a suggested bonus figure alongside the flat monthly `payRate`.
  This is presented as a report for a human (Admin) to review and approve,
  not an automatic payroll write — getting this wrong has direct financial
  and morale consequences, so a human-in-the-loop approval step is the
  right default for at least the first two or three payroll cycles.
- Explicitly deferred to a later phase, once the above is validated: direct
  payroll-system integration/export (this app doesn't run payroll disbursement
  today — it tracks pay *structure*, not payment execution) and any
  automatic pay-rate adjustment without human sign-off.

**New work:** 1-2 migrations, a payroll-close report page/API (read-heavy,
aggregation over existing `WorkOrder`/`TimeActivity` data — no new
day-to-day data entry burden on technicians), an admin screen for bonus
rules.

**Complexity:** Medium technically, high organizationally. Recommend
treating the *metric definitions* (what "on time" and "quality" mean in
practice) as a business decision to be nailed down with the technicians'
direct manager before writing the bonus-calculation logic — a
performance-pay system that feels arbitrary or is easy to game is worse
than no performance-pay system at all.

---

## Summary Table

| # | Capability | Builds on | New models | Complexity |
|---|---|---|---|---|
| 1 | Asset Serialization & Barcode Scanning | Equipment, POS Quick-Tap | `Equipment` fields + `EquipmentEvent` | Low-medium |
| 2 | Compliance Certificate Generation | InvoiceDocument/.print-area, WorkOrder inspection items | `WorkOrder` fields | Low |
| 3 | GPS Location Validation | Mobile POS Start/Complete actions | `Site`/`WorkOrder` fields | Medium |
| 4 | Automated Compliance Scheduling | scheduling.ts, Servicing Request pipeline, Vercel Cron | `ComplianceSchedulePolicy` | Low-medium |
| 5 | Performance-Linked Payroll | Monthly pay structure, TimeActivity, WorkOrder timestamps | `PerformanceBonusRule` | Medium (org: high) |

None of these require a change of stack, hosting, or core architecture —
every proposal above is additive to the existing Next.js/Prisma/Postgres
foundation and reuses patterns (document numbering, `.print-area` printing,
Vercel Cron, admin-configurable reference data, server+client RBAC scoping)
that are already proven in the shipped codebase.
