'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, Pencil, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { EnvSummary } from '@/lib/environments-client'

/**
 * One environment, rendered identically wherever environments are listed.
 *
 * Both surfaces used to carry their own copy of this markup. Shared so the Hub and Settings
 * cannot disagree about how an environment looks or which actions it offers.
 */
function EnvironmentRow({
  env, busy, onActivate, onEdit, onDelete,
}: {
  env: EnvSummary
  busy: boolean
  onActivate: (id: number) => void
  onEdit: (id: number) => void
  onDelete: (env: EnvSummary) => void
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border p-3 transition-colors',
        // The active target is the one fact this list exists to convey, so it carries a tint
        // and not just a badge — findable without reading every row.
        env.isActive ? 'border-primary/40 bg-primary/5' : 'hover:bg-muted/40',
      )}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <p className="flex items-center gap-2 text-sm font-medium">
          <span className="truncate">{env.name}</span>
          {env.isActive && (
            <Badge variant="secondary" className="shrink-0 gap-1 text-[10px]">
              <Check className="h-3 w-3" /> Active
            </Badge>
          )}
        </p>
        {env.description && (
          <p className="text-xs leading-relaxed text-muted-foreground">{env.description}</p>
        )}
        <p className="truncate font-mono text-[10px] text-muted-foreground">
          {env.keys.length} variable{env.keys.length === 1 ? '' : 's'}
          {env.keys.length ? ` · ${env.keys.slice(0, 4).join(', ')}${env.keys.length > 4 ? '…' : ''}` : ''}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {/* The button keeps its slot when active so the row's controls never shift sideways
            as you switch targets. */}
        {env.isActive ? (
          <span className="px-2 text-xs text-muted-foreground">In use</span>
        ) : (
          <Button size="sm" variant="secondary" className="h-8 text-xs"
                  disabled={busy} onClick={() => onActivate(env.id)}>
            Use this
          </Button>
        )}
        <Button size="icon" variant="ghost" className="size-8"
                title={`Edit ${env.name}`} disabled={busy} onClick={() => onEdit(env.id)}>
          <Pencil className="h-3.5 w-3.5" />
          <span className="sr-only">Edit {env.name}</span>
        </Button>
        <Button size="icon" variant="ghost" className="size-8"
                title={env.isActive ? 'Switch away before deleting' : `Delete ${env.name}`}
                disabled={busy || env.isActive} onClick={() => onDelete(env)}>
          <Trash2 className="h-3.5 w-3.5" />
          <span className="sr-only">Delete {env.name}</span>
        </Button>
      </div>
    </div>
  )
}

/**
 * The list of environments plus its loading and empty states.
 *
 * `envs === null` is "still loading" and renders skeletons rather than the empty-state warning —
 * the old switcher showed nothing at all while loading, so a populated app looked empty for a
 * beat and then jumped.
 */
export function EnvironmentList({
  envs, busy, onActivate, onEdit, onDelete,
}: {
  envs: EnvSummary[] | null
  busy: boolean
  onActivate: (id: number) => void
  onEdit: (id: number) => void
  onDelete: (env: EnvSummary) => void
}) {
  if (envs === null) {
    return (
      <div className="space-y-2">
        <div className="h-[72px] animate-pulse rounded-lg bg-muted/50" />
        <div className="h-[72px] animate-pulse rounded-lg bg-muted/30" />
      </div>
    )
  }

  if (envs.length === 0) {
    return (
      <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs leading-relaxed">
        No environments for this app yet — runs use <code>automation-hub/.env</code>, which only
        the person who edited it can see. Create one to make the target explicit.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {envs.map((e) => (
        <EnvironmentRow key={e.id} env={e} busy={busy}
                        onActivate={onActivate} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  )
}
