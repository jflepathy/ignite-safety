import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { canTechnicianAccess } from '@/lib/work-order-status';
import { z } from 'zod';

// Lets a technician fill in a missing phone number or email straight from
// the invoice-share screen (Session 18) -- previously there was no way to
// send an invoice by WhatsApp/email at all if the customer record didn't
// already have one on file, and a technician has no reach into the desktop
// Customers screen to add it themselves.
//
// Deliberately narrow: its own endpoint (not the shared ADMIN/SALES-only
// PATCH /api/customers/[id]) so it's technician-reachable but scoped to
// their own job's customer, and it only ever *fills a blank* field for a
// TECHNICIAN caller -- it never overwrites a phone/email that's already on
// file, so this can't be used to silently change existing contact details.
// Admin has no such restriction, matching their normal customer-edit access.
const Schema = z
  .object({
    phone: z.string().trim().min(3).optional(),
    email: z.string().trim().email().optional(),
  })
  .refine((d) => d.phone || d.email, { message: 'Provide a phone number or email.' });

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireRole('ADMIN', 'TECHNICIAN');
  if (error) return error;

  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: { workOrder: { include: { additionalTechnicians: true } }, customer: true },
  });
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isTechnician = session!.user.role === 'TECHNICIAN';
  if (isTechnician) {
    const wo = invoice.workOrder;
    if (!wo || !canTechnicianAccess(wo, wo.additionalTechnicians.map((t) => t.technicianId), session!.user.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (data.phone && invoice.customer.phone) {
      return NextResponse.json({ error: { formErrors: ['This customer already has a phone number on file.'] } }, { status: 400 });
    }
    if (data.email && invoice.customer.email) {
      return NextResponse.json({ error: { formErrors: ['This customer already has an email on file.'] } }, { status: 400 });
    }
  }

  const updateData: { phone?: string; email?: string } = {};
  if (data.phone) updateData.phone = data.phone;
  if (data.email) updateData.email = data.email;

  const customer = await prisma.customer.update({ where: { id: invoice.customerId }, data: updateData });
  return NextResponse.json({ id: customer.id, phone: customer.phone, email: customer.email });
}
