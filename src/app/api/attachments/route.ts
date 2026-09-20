import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { z } from 'zod';

// Polymorphic attachments (entityType + entityId, no Prisma relation) so a
// single model can attach to invoices, estimates, bills, work orders, etc.
// Files are stored as data: URLs on the record itself — fine for the small
// documents this app deals with, and avoids standing up a blob store for a
// standalone system with no third-party integrations.
export async function GET(req: NextRequest) {
  const { error } = await requireRole('ADMIN', 'SALES', 'TECHNICIAN');
  if (error) return error;
  const entityType = req.nextUrl.searchParams.get('entityType');
  const entityId = req.nextUrl.searchParams.get('entityId');
  if (!entityType || !entityId) return NextResponse.json({ error: 'entityType and entityId are required' }, { status: 400 });
  const attachments = await prisma.attachment.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(attachments);
}

const CreateSchema = z.object({
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  fileName: z.string().min(1),
  fileUrl: z.string().min(1), // data: URL
  fileSizeBytes: z.number().int().nonnegative().optional(),
});

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole('ADMIN', 'SALES', 'TECHNICIAN');
  if (error) return error;
  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  if (parsed.data.fileSizeBytes && parsed.data.fileSizeBytes > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'Files over 5MB are not supported yet.' }, { status: 400 });
  }
  const attachment = await prisma.attachment.create({
    data: { ...parsed.data, uploadedById: session!.user.id },
  });
  return NextResponse.json(attachment, { status: 201 });
}
