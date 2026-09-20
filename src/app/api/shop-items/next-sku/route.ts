import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { nextItemSku } from '@/lib/numbering';

export async function POST() {
  const { error } = await requireRole('ADMIN');
  if (error) return error;
  const sku = await nextItemSku();
  return NextResponse.json({ sku });
}
