import { cn } from '@/lib/utils';

const COLORS: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  SENT: 'bg-blue-100 text-blue-700',
  PENDING: 'bg-slate-100 text-slate-700',
  SCHEDULED: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  PAST_DUE: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-slate-100 text-slate-500 line-through',
  PAID: 'bg-emerald-100 text-emerald-700',
  PARTIAL: 'bg-amber-100 text-amber-700',
  OVERDUE: 'bg-red-100 text-red-700',
  VOID: 'bg-slate-100 text-slate-500 line-through',
  NEW: 'bg-blue-100 text-blue-700',
  CONVERTED: 'bg-emerald-100 text-emerald-700',
  ACCEPTED: 'bg-emerald-100 text-emerald-700',
  DECLINED: 'bg-red-100 text-red-700',
  EXPIRED: 'bg-slate-100 text-slate-500',
  ISSUED: 'bg-blue-100 text-blue-700',
  APPLIED: 'bg-emerald-100 text-emerald-700',
  PASS: 'bg-emerald-100 text-emerald-700',
  FAIL: 'bg-red-100 text-red-700',
  NA: 'bg-slate-100 text-slate-500',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('badge', COLORS[status] ?? 'bg-slate-100 text-slate-700')}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}
