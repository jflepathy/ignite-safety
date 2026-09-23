// Work orders don't carry a background job that flips their state — both
// the overdue badge and the "this assignment went stale" rule below are
// derived at read time from timestamps already on the row, and enforced
// again wherever a write could act on a stale assignment (Session 12).

/** Graduated overdue display, derived from how many days past the
 * scheduled date a PENDING/SCHEDULED job is:
 *   days 0–3 late:  no flag
 *   days 4–6 late:  WARNING
 *   day 7+ late:    PAST_DUE
 */
export function displayStatus(status: string, scheduledDate: Date | null): string {
  if ((status === 'PENDING' || status === 'SCHEDULED') && scheduledDate) {
    const daysLate = (Date.now() - scheduledDate.getTime()) / 86_400_000;
    if (daysLate >= 7) return 'PAST_DUE';
    if (daysLate >= 4) return 'WARNING';
  }
  return status;
}

export const STALE_ASSIGNMENT_DAYS = 4;

const OPEN_STATUSES = new Set(['PENDING', 'SCHEDULED', 'IN_PROGRESS']);

/** A job that's been sitting assigned to one technician for 4+ days with
 * no activity on it at all (no save, no status change — nothing has
 * touched `updatedAt` since the assignment itself) drops back to
 * "unassigned" for every other technician: they'll see it in their open
 * jobs list again and can claim it, same as a never-assigned job. This is
 * a display/claim-eligibility rule, not a destructive write — the row's
 * `assignedTechnicianId` isn't cleared automatically; a fresh claim just
 * overwrites it. */
export function isStaleAssignment(wo: { assignedTechnicianId: string | null; status: string; updatedAt: Date }): boolean {
  if (!wo.assignedTechnicianId) return false;
  if (!OPEN_STATUSES.has(wo.status)) return false;
  const daysSinceUpdate = (Date.now() - wo.updatedAt.getTime()) / 86_400_000;
  return daysSinceUpdate >= STALE_ASSIGNMENT_DAYS;
}

/** True when this job is open for the given technician to claim — either
 * never assigned, already theirs, or stale (assigned to someone else but
 * idle for 4+ days). Claiming always acts on the primary
 * assignedTechnicianId — additional technicians (below) are admin-added,
 * not self-claimed. */
export function isClaimableBy(
  wo: { assignedTechnicianId: string | null; status: string; updatedAt: Date },
  technicianId: string
): boolean {
  if (wo.assignedTechnicianId === technicianId) return true;
  if (wo.assignedTechnicianId === null) return true;
  return isStaleAssignment(wo);
}

/** True when a job has this technician on it at all — either as the
 * primary assignedTechnicianId or as one of the admin-added additional
 * technicians (Session 20, multi-technician jobs with a split incentive).
 * `additionalTechnicianIds` is the job's WorkOrderTechnician rows' ids,
 * fetched by the caller. */
export function isOnJob(
  wo: { assignedTechnicianId: string | null },
  additionalTechnicianIds: string[],
  technicianId: string
): boolean {
  return wo.assignedTechnicianId === technicianId || additionalTechnicianIds.includes(technicianId);
}

/** True when this technician may view/act on this job — on it (primary or
 * additional), unassigned, or stale. This is the general access check used
 * everywhere a technician-facing route or page scopes a Work Order/Invoice
 * to "my job"; it supersedes a bare `assignedTechnicianId === me` check now
 * that a job can have more than one technician on it. */
export function canTechnicianAccess(
  wo: { assignedTechnicianId: string | null; status: string; updatedAt: Date },
  additionalTechnicianIds: string[],
  technicianId: string
): boolean {
  if (wo.assignedTechnicianId === null) return true;
  if (isOnJob(wo, additionalTechnicianIds, technicianId)) return true;
  return isStaleAssignment(wo);
}
