'use client'

import { cn } from '@/lib/utils'

export interface PhaseEvent {
  label: string
  detail?: string
  step: number
  total: number
}

export function AIProgressBar({ phase, className }: { phase: PhaseEvent | null; className?: string }) {
  const pct = phase ? Math.round((phase.step / phase.total) * 100) : 0

  return (
    <div className={cn('space-y-2 rounded-lg border bg-muted/30 px-4 py-3', className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{phase?.label ?? 'Connecting…'}</span>
        {phase && (
          <span className="text-xs text-muted-foreground tabular-nums">
            Step {phase.step} of {phase.total}
          </span>
        )}
      </div>
      {phase?.detail && (
        <p className="text-xs text-muted-foreground">{phase.detail}</p>
      )}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        {phase ? (
          <div
            className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        ) : (
          <div className="h-full w-1/4 rounded-full bg-primary/50 animate-pulse" />
        )}
      </div>
    </div>
  )
}
