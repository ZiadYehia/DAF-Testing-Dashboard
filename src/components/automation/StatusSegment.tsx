import { cn } from '@/lib/utils'

export type StatusValue = 'all' | 'pass' | 'fail' | 'never_run'

// Dot colors mirror the folder-header status dots so pass/fail/never-run
// read the same way everywhere in the hub, not just here.
const SEGMENTS: { key: StatusValue; label: string; dot?: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pass', label: 'Pass', dot: 'bg-emerald-500' },
  { key: 'fail', label: 'Fail', dot: 'bg-red-500' },
  { key: 'never_run', label: 'Never run', dot: 'bg-muted-foreground/40' },
]

// L2 "State" row — exclusive choice, deliberately lighter than ScopeStrip
// (no border, muted-fill active state) so it reads as the secondary level.
export function StatusSegment({
  value,
  onChange,
  counts,
}: {
  value: StatusValue
  onChange: (v: StatusValue) => void
  counts: { all: number; pass: number; fail: number; never_run: number }
}): React.ReactElement {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">State</span>
      <div className="flex items-center gap-0.5 whitespace-nowrap">
        {SEGMENTS.map((s) => {
          const count = counts[s.key]
          const active = value === s.key
          return (
            <button
              key={s.key}
              onClick={() => onChange(s.key)}
              title={`${s.label} · ${count}`}
              className={cn(
                'shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-colors',
                active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
                count === 0 && 'opacity-50',
              )}
            >
              <span className="inline-flex items-center gap-1">
                {s.dot && <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />}
                {count}
                {(!s.dot || active) && ` ${s.label}`}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
