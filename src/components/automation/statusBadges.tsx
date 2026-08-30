'use client'

import { AlertTriangle, CheckCircle2, XCircle, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'

export type RunStatus = 'pass' | 'fail' | 'never_run'

export interface RunRecord {
  ts: string
  status: 'pass' | 'fail'
  durationMs: number
  hasVideo: boolean
  hasTrace: boolean
  error?: string
}

/**
 * A project is "flaky" when its recent history flip-flops between pass and fail
 * (≥2 status changes in the kept run history) — the team should distrust it and
 * stabilize the spec rather than chase each red run.
 */
export function isFlaky(runs: RunRecord[]): boolean {
  let flips = 0
  for (let i = 1; i < runs.length; i++) {
    if (runs[i].status !== runs[i - 1].status) flips++
  }
  return flips >= 2
}

export function FlakyBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400"
      title="Recent runs flip between pass and fail — stabilize this spec"
    >
      <AlertTriangle className="h-3 w-3" /> Flaky
    </span>
  )
}

export function StatusPill({ status }: { status: RunStatus }) {
  const map = {
    pass: { icon: CheckCircle2, cls: 'text-emerald-600 dark:text-emerald-400', label: 'Passing' },
    fail: { icon: XCircle, cls: 'text-red-600 dark:text-red-400', label: 'Failing' },
    never_run: { icon: Circle, cls: 'text-muted-foreground', label: 'Never run' },
  }[status]
  const Icon = map.icon
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', map.cls)}>
      <Icon className="h-3.5 w-3.5" />
      {map.label}
    </span>
  )
}
