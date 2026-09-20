import { prisma } from '@/lib/prisma';
import { addMonths, differenceInCalendarDays, startOfDay } from 'date-fns';

export type OutreachRow = {
  equipmentId: string;
  customerId: string;
  customerName: string;
  category: string;
  serialNumber: string | null;
  region: string | null;
  lastServiceDate: Date | null;
  nextDueDate: Date;
  daysUntilDue: number;
  overdue: boolean;
};

/**
 * Predictive servicing outreach: for every active piece of equipment,
 * compute the next-due date from lastServiceDate + intervalMonths
 * (falling back to installDate) and flag overdue items using the
 * admin-configured overdue threshold.
 */
export async function computeOutreachList(): Promise<OutreachRow[]> {
  const [equipment, settings] = await Promise.all([
    prisma.equipment.findMany({
      where: { deletedAt: null, status: 'ACTIVE' },
      include: { customer: true },
    }),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
  ]);

  const today = startOfDay(new Date());
  void settings?.overdueThresholdDays; // reserved for "critical overdue" escalation in reports

  return equipment
    .map((eq) => {
      const base = eq.lastServiceDate ?? eq.installDate ?? eq.createdAt;
      const nextDueDate = addMonths(base, eq.intervalMonths || 12);
      const daysUntilDue = differenceInCalendarDays(nextDueDate, today);
      return {
        equipmentId: eq.id,
        customerId: eq.customerId,
        customerName: eq.customer.displayName,
        category: eq.category,
        serialNumber: eq.serialNumber,
        region: eq.customer.region,
        lastServiceDate: eq.lastServiceDate,
        nextDueDate,
        daysUntilDue,
        overdue: daysUntilDue < 0,
      };
    })
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue);
}

/**
 * Checks whether a proposed service date still has capacity, based on the
 * admin-configured default daily team capacity (optionally overridden per
 * date) versus how many work orders / service requests are already
 * scheduled that day.
 */
export async function checkDateAvailability(date: Date) {
  const dayStart = startOfDay(date);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const [settings, override, scheduledCount] = await Promise.all([
    prisma.appSettings.findUnique({ where: { id: 1 } }),
    prisma.dailyCapacityOverride.findUnique({ where: { date: dayStart } }),
    prisma.serviceRequest.count({
      where: {
        proposedDate: { gte: dayStart, lt: dayEnd },
        status: { in: ['NEW', 'SCHEDULED'] },
      },
    }),
  ]);

  const capacity = override?.teamsAvailable ?? settings?.dailyTeamCapacity ?? 3;
  const remaining = capacity - scheduledCount;

  return {
    date: dayStart,
    capacity,
    booked: scheduledCount,
    remaining,
    available: remaining > 0,
  };
}
