import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { checkDateAvailability } from '@/lib/scheduling';

export async function GET(req: NextRequest) {
  const { error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;
  const dateParam = req.nextUrl.searchParams.get('date');
  if (!dateParam) return NextResponse.json({ error: 'date is required' }, { status: 400 });
  const result = await checkDateAvailability(new Date(dateParam));
  return NextResponse.json(result);
}
