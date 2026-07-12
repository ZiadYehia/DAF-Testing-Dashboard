'use client'

// Dismissible banner for the generate routes' SSE `{type:'warning', missing}` event —
// surfaces AI-context gaps without interrupting generation. Shared by test-case and
// bug-report generation flows so they read as one system.

import { AlertTriangle, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ContextWarningBannerProps {
  missing: string[]
  onDismiss: () => void
  /** Callback form — used when the caller has an inline edit surface (e.g. a dialog) to open. */
  onAction?: () => void
  /** Navigation form — used when there's no inline edit surface for this scope. */
  href?: string
  actionLabel?: string
  className?: string
}

export function ContextWarningBanner({
  missing,
  onDismiss,
  onAction,
  href,
  actionLabel = 'Fill in the missing context',
  className,
}: ContextWarningBannerProps) {
  if (missing.length === 0) return null

  const shown = missing.slice(0, 6)
  const rest = missing.length - shown.length

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300',
        className
      )}
    >
      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-sm font-medium">AI context incomplete</p>
        <p className="text-xs text-amber-800/90 dark:text-amber-400/90">
          {shown.join(' · ')}
          {rest > 0 ? ` · +${rest} more` : ''}
        </p>
        {onAction ? (
          <button type="button" onClick={onAction} className="text-xs font-medium underline underline-offset-2">
            {actionLabel} →
          </button>
        ) : href ? (
          <a href={href} className="inline-block text-xs font-medium underline underline-offset-2">
            {actionLabel} →
          </a>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded p-1 text-amber-700 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-900/40"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
