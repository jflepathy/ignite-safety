import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import EquipmentManager from '@/components/outreach/equipment-manager';

export default async function EquipmentPage() {
  const [equipment, customers, session] = await Promise.all([
    prisma.equipment.findMany({
      where: { deletedAt: null },
      include: { customer: { select: { id: true, displayName: true } } },
      orderBy: [{ customer: { displayName: 'asc' } }, { category: 'asc' }],
    }),
    prisma.customer.findMany({ where: { deletedAt: null }, select: { id: true, displayName: true }, orderBy: { displayName: 'asc' } }),
    getServerSession(authOptions),
  ]);
  const rows = equipment.map((e) => ({
    id: e.id,
    customerId: e.customerId,
    customerName: e.customer.displayName,
    category: e.category as string,
    serialNumber: e.serialNumber,
    make: e.make,
    model: e.model,
    locationDescription: e.locationDescription,
    installDate: e.installDate ? e.installDate.toISOString().slice(0, 10) : null,
    lastServiceDate: e.lastServiceDate ? e.lastServiceDate.toISOString().slice(0, 10) : null,
    intervalMonths: e.intervalMonths,
    status: e.status,
  }));
  return <EquipmentManager rows={rows} customers={customers} isAdmin={session?.user.role === 'ADMIN'} />;
}
