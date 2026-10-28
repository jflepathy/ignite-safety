import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';

/**
 * Public share links exist for invoices, estimates and sales receipts.
 * Older records were created without a token, so the detail pages call this
 * to create one on first view.
 */
export async function ensureShareToken(kind: 'invoice' | 'estimate' | 'receipt', id: string, current: string | null): Promise<string> {
  if (current) return current;
  const token = randomBytes(16).toString('hex');
  if (kind === 'invoice') await prisma.invoice.update({ where: { id }, data: { shareToken: token } });
  else if (kind === 'estimate') await prisma.estimate.update({ where: { id }, data: { shareToken: token } });
  else await prisma.salesReceipt.update({ where: { id }, data: { shareToken: token } });
  return token;
}
