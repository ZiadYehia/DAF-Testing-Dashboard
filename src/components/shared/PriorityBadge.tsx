import { cn } from '@/lib/utils'

const PRIORITY_STYLES: Record<string, string> = {
  P1: 'bg-red-100 text-red-700 border-red-200/70 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/20',
  P2: 'bg-orange-100 text-orange-700 border-orange-200/70 dark:bg-orange-500/15 dark:text-orange-400 dark:border-orange-500/20',
  P3: 'bg-amber-100 text-amber-700 border-amber-200/70 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/20',
  P4: 'bg-zinc-100 text-zinc-600 border-zinc-200/70 dark:bg-zinc-500/15 dark:text-zinc-400 dark:border-zinc-500/20',
}

export function PriorityBadge({ priority }: { priority: string }) {
  const key = priority?.includes('P1')
    ? 'P1'
    : priority?.includes('P2')
    ? 'P2'
    : priority?.includes('P3')
    ? 'P3'
    : priority?.includes('P4')
    ? 'P4'
    : ''
  const styles = PRIORITY_STYLES[key] ?? 'bg-gray-100 text-gray-700 border-gray-200'
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        styles
      )}
    >
      {priority || '—'}
    </span>
  )
}
