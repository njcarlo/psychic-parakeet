import { titleize } from '../lib/format';

const tones: Record<string, string> = {
  completed: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  paid: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  approved: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  sent: 'bg-sky-100 text-sky-800 ring-sky-200',
  assigned: 'bg-cyan-100 text-cyan-800 ring-cyan-200',
  in_progress: 'bg-teal-100 text-teal-800 ring-teal-200',
  scheduled: 'bg-slate-100 text-slate-700 ring-slate-200',
  draft: 'bg-slate-100 text-slate-700 ring-slate-200',
  pending: 'bg-amber-100 text-amber-800 ring-amber-200',
  overdue: 'bg-red-100 text-red-800 ring-red-200',
  open: 'bg-red-100 text-red-800 ring-red-200',
  cancelled: 'bg-zinc-200 text-zinc-700 ring-zinc-300',
  no_show: 'bg-zinc-200 text-zinc-700 ring-zinc-300',
  skipped: 'bg-zinc-200 text-zinc-700 ring-zinc-300',
  void: 'bg-zinc-200 text-zinc-700 ring-zinc-300',
  rejected: 'bg-red-100 text-red-800 ring-red-200'
};

export function StatusBadge({ status }: { status?: string | null }) {
  const key = status ?? 'unknown';
  const tone = tones[key] ?? 'bg-coastal-50 text-coastal-700 ring-coastal-100';

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${tone}`}>
      {titleize(key)}
    </span>
  );
}
