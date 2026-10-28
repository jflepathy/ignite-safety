import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { isCronRequest } from '@/lib/cron-auth';
import { runPaymentReminders } from '@/lib/jobs/reminders';
import { runRecurringInvoices } from '@/lib/jobs/recurring';
import { runServiceDueNotices } from '@/lib/jobs/service-due';
import type { JobResult } from '@/lib/jobs/types';

export const dynamic = 'force-dynamic';

// Scheduled jobs. Called once a day by the Worker's cron trigger (worker.ts,
// authenticated with a token derived from NEXTAUTH_SECRET) and by admins from
// Settings > Scheduled Jobs ("preview" = dry run, "run now" = real).
async function handle(req: NextRequest, { params }: { params: { job: string } }) {
  const cron = await isCronRequest(req);
  if (!cron) {
    const { error } = await requireRole('ADMIN');
    if (error) return error;
  }
  const dryRun = !cron && req.nextUrl.searchParams.get('dryRun') !== '0';
  const origin = req.nextUrl.origin;
  const job = params.job;
  let result: JobResult;
  try {
    if (job === 'reminders') result = await runPaymentReminders({ dryRun, origin });
    else if (job === 'recurring') result = await runRecurringInvoices({ dryRun });
    else if (job === 'service-due') result = await runServiceDueNotices({ dryRun });
    else return NextResponse.json({ error: 'Unknown job' }, { status: 404 });
  } catch (e: any) {
    result = { ok: false, summary: `Job crashed: ${e?.message ?? e}`, items: [], more: false };
  }
  if (!dryRun) {
    try {
      await prisma.cronRun.create({ data: { job, ok: result.ok, summary: [result.summary, ...result.items.slice(0, 20)].join('\n').slice(0, 4000) } });
    } catch {
      /* logging is best effort */
    }
  }
  return NextResponse.json({ job, dryRun, ...result });
}

export const GET = handle;
export const POST = handle;
