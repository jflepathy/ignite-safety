import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { computeOutreachList } from '@/lib/scheduling';

export async function GET() {
  const { error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;
  const rows = await computeOutreachList();
  return NextResponse.json(rows);
}
