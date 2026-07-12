import { cn } from '@/lib/utils'

type Status = 'draft' | 'reported' | 'Pass' | 'Fail' | 'Blocked/Skipped' | 'Under Testing' | string

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-amber-100 text-amber-800 border-amber-200/70 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/20',
  reported: 'bg-emerald-100 text-emerald-800 border-emerald-200/70 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/20',
  Pass: 'bg-emerald-100 text-emerald-800 border-emerald-200/70 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/20',
  Fail: 'bg-red-100 text-red-700 border-red-200/70 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/20',
  'Blocked/Skipped': 'bg-zinc-100 text-zinc-600 border-zinc-200/70 dark:bg-zinc-500/15 dark:text-zinc-400 dark:border-zinc-500/20',
  'Under Testing': 'bg-blue-100 text-blue-700 border-blue-200/70 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/20',
}

export function StatusBadge({ status }: { status: Status }) {
  const styles = STATUS_STYLES[status] ?? 'bg-zinc-100 text-zinc-600 border-zinc-200/70 dark:bg-zinc-500/15 dark:text-zinc-400 dark:border-zinc-500/20'
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize',
        styles
      )}
    >
      {status}
    </span>
  )
}
