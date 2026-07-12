'use client'

import { Bot, Eye, EyeOff, Zap } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { AIModel } from '@/lib/ai'
import { cn } from '@/lib/utils'

const PROVIDER_META: Record<string, { label: string; color: string }> = {
  google:    { label: 'Google',    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' },
  anthropic: { label: 'Anthropic', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400' },
}

interface ModelSelectorProps {
  models: AIModel[]
  value: string
  onChange: (value: string) => void
  size?: 'sm' | 'default'
  showVisionWarning?: boolean
}

function VisionBadge({ supported }: { supported: boolean }) {
  if (supported) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
        <Eye className="size-2.5" /> Vision
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
      <EyeOff className="size-2.5" /> No vision
    </span>
  )
}

function TriggerContent({ model }: { model: AIModel | undefined }) {
  if (!model) return <span className="text-muted-foreground">Select a model…</span>
  const meta = PROVIDER_META[model.provider]
  return (
    <span className="flex items-center gap-2">
      <Bot className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="font-medium">{model.name}</span>
      <span className={cn('hidden sm:inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none', meta?.color ?? 'bg-muted text-muted-foreground')}>
        {meta?.label ?? model.provider}
      </span>
    </span>
  )
}

export function ModelSelector({ models, value, onChange, size = 'default', showVisionWarning = false }: ModelSelectorProps) {
  const selected = models.find((m) => m.id === value)
  const providers = Array.from(new Set(models.map((m) => m.provider)))

  return (
    <div className="space-y-1.5">
      <Select value={value} onValueChange={(v) => { if (v) onChange(v) }}>
        <SelectTrigger size={size} className="w-full min-w-[220px] rounded-lg">
          <SelectValue>
            <TriggerContent model={selected} />
          </SelectValue>
        </SelectTrigger>

        <SelectContent align="start" side="bottom" sideOffset={6} alignItemWithTrigger={false} className="w-[340px]">
          {providers.map((provider, pi) => {
            const group = models.filter((m) => m.provider === provider)
            const meta = PROVIDER_META[provider]
            return (
              <div key={provider}>
                {pi > 0 && <SelectSeparator />}
                <SelectGroup>
                  <SelectLabel className="flex items-center gap-1.5">
                    <Zap className="size-3 text-muted-foreground" />
                    {meta?.label ?? provider}
                  </SelectLabel>
                  {group.map((m) => (
                    <SelectItem
                      key={m.id}
                      value={m.id}
                      label={m.name}
                      disabled={!m.enabled}
                      className={cn(!m.enabled && 'opacity-50 cursor-not-allowed')}
                    >
                      <div className="flex flex-col gap-0.5 py-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm leading-tight">{m.name}</span>
                          <VisionBadge supported={m.supportsVision} />
                          {!m.enabled && (
                            <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                              Needs key
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground leading-snug">
                          {m.enabled ? m.description : m.disabledReason}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </div>
            )
          })}
        </SelectContent>
      </Select>

      {showVisionWarning && selected && !selected.supportsVision && (
        <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
          <EyeOff className="size-3 shrink-0" />
          This model does not support vision — screenshots will be skipped during generation.
        </p>
      )}
    </div>
  )
}
