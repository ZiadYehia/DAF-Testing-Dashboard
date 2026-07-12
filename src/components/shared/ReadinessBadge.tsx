'use client'

// Small "is this ready for AI generation" indicator. Fetches
// GET /api/{app}/readiness (optionally scoped to a module/feature) and renders a
// color-coded badge; hovering lists the specific missing answers.
//
// Kept dependency-free from src/lib/readiness.ts (a server-only module) — the
// shape below mirrors its `Readiness` type just closely enough for rendering.

import { useEffect, useState } from 'react'
import { CheckCircle2, AlertTriangle, CircleDashed } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

interface ReadinessGroup {
  id: string
  title: string
  answered: number
  total: number
  missing: string[]
}

interface ReadinessData {
  score: number
  groups: ReadinessGroup[]
  capabilities: {
    testcaseGen: string[]
    bugGen: string[]
    automation: string[]
  }
}

export interface ReadinessBadgeProps {
  /** App slug — every readiness check is app-scoped. */
  app: string
  /** Module slug — narrows to that module's own readiness (still rolls up app-level gaps). */
  module?: string
  /** Feature slug — narrows to that feature's own readiness. */
  feature?: string
  className?: string
}

function statusFor(score: number) {
  if (score >= 100) {
    return {
      label: 'Ready',
      Icon: CheckCircle2,
      cls: 'text-emerald-600 border-emerald-200 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:bg-emerald-950/30',
    }
  }
  if (score > 0) {
    return {
      label: `${score}% ready`,
      Icon: AlertTriangle,
      cls: 'text-amber-600 border-amber-200 bg-amber-50 dark:text-amber-400 dark:border-amber-800 dark:bg-amber-950/30',
    }
  }
  return {
    label: 'Not started',
    Icon: CircleDashed,
    cls: 'text-muted-foreground',
  }
}

/** AI-readiness badge. Self-fetches; safe to drop into a list of rows (one request per row). */
export function ReadinessBadge({ app, module, feature, className }: ReadinessBadgeProps) {
  const [data, setData] = useState<ReadinessData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const qs = module ? `?module=${encodeURIComponent(module)}` : feature ? `?feature=${encodeURIComponent(feature)}` : ''
    fetch(`/api/${app}/readiness${qs}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled) setData(json)
      })
      .catch(() => {
        if (!cancelled) setData(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [app, module, feature])

  if (loading) {
    return <span className={`inline-block h-5 w-20 rounded-full bg-muted animate-pulse ${className ?? ''}`} />
  }
  if (!data) return null

  const { label, Icon, cls } = statusFor(data.score)
  const allMissing = data.groups.flatMap((g) => g.missing.map((m) => `${g.title}: ${m}`))

  const badge = (
    <Badge variant="outline" className={`gap-1 text-xs ${cls} ${className ?? ''}`}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  )

  if (allMissing.length === 0) return badge

  return (
    <Tooltip>
      <TooltipTrigger className="inline-flex">{badge}</TooltipTrigger>
      <TooltipContent side="bottom" align="start" className="max-w-sm text-left">
        <div className="space-y-1">
          <p className="font-medium">Missing for AI generation:</p>
          <ul className="list-disc pl-3 space-y-0.5">
            {allMissing.slice(0, 6).map((m) => (
              <li key={m}>{m}</li>
            ))}
            {allMissing.length > 6 && <li>+{allMissing.length - 6} more</li>}
          </ul>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
