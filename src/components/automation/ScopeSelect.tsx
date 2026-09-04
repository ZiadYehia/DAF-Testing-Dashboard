'use client'

import * as React from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

export interface ScopeOption {
  key: string
  label: string
  icon?: React.ReactNode
  count: number
}

/**
 * Level-1 "Scope" selector.
 *
 * This was a one-line chip strip that scrolled sideways, which measured 254px of
 * room for 525px of chips inside the list column — over half the modules sat
 * off-screen behind a hidden scrollbar, so the options users needed most were the
 * ones they could not see. A single trigger plus a checkbox list keeps every
 * module reachable at any module count, and matches the tag disclosure below it.
 */
export function ScopeSelect({
  options,
  selected,
  onToggle,
  onClear,
  total,
}: {
  options: ScopeOption[]
  selected: string[]
  onToggle: (key: string) => void
  onClear: () => void
  total: number
}): React.ReactElement {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')

  const q = query.trim().toLowerCase()
  const filtered = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options

  // Name the selection rather than counting it: one module reads as itself, and
  // several read as "first +N" so the trigger still fits the column.
  const label = (() => {
    if (selected.length === 0) return 'All modules'
    const first = options.find((o) => o.key === selected[0])?.label ?? selected[0]
    return selected.length === 1 ? first : `${first} +${selected.length - 1}`
  })()

  return (
    <div className="flex min-w-0 items-center gap-2 px-0.5">
      <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Scope
      </span>
      <DropdownMenu
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setQuery('')
        }}
      >
        <DropdownMenuTrigger
          title="Scope the list to one or more modules"
          className={cn(
            'inline-flex min-w-0 flex-1 items-center justify-between gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors',
            selected.length > 0
              ? 'border-primary bg-primary/10 text-foreground'
              : 'border-border/60 text-muted-foreground hover:border-primary/50 hover:text-foreground',
          )}
        >
          <span className="truncate">{label}</span>
          <ChevronDown className="h-3 w-3 shrink-0" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60 p-2">
          {/* Searching only earns its place once the list outgrows a glance. */}
          {options.length > 6 && (
            <div className="relative mb-1.5">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                // The menu's typeahead listens for keydown on this popup and
                // would otherwise swallow every keystroke typed here.
                onKeyDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                placeholder="Filter modules…"
                className="h-7 pl-6 text-xs"
              />
            </div>
          )}
          <DropdownMenuItem
            onClick={() => onClear()}
            className={cn('justify-between', selected.length === 0 && 'font-medium text-foreground')}
          >
            <span>All modules</span>
            <span className="ml-2 shrink-0 text-muted-foreground">{total}</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-1.5 py-2 text-center text-xs text-muted-foreground">No modules match</div>
            ) : (
              filtered.map((o) => (
                <DropdownMenuCheckboxItem
                  key={o.key}
                  checked={selected.includes(o.key)}
                  onCheckedChange={() => onToggle(o.key)}
                  className="justify-between"
                >
                  <span className="inline-flex min-w-0 items-center gap-1.5">
                    {o.icon}
                    <span className="truncate">{o.label}</span>
                  </span>
                  <span className="ml-2 shrink-0 text-muted-foreground">{o.count}</span>
                </DropdownMenuCheckboxItem>
              ))
            )}
          </div>
          {selected.length > 0 && (
            <button
              onClick={onClear}
              className="mt-1 w-full rounded-md px-1.5 py-1 text-left text-[11px] text-muted-foreground hover:text-foreground"
            >
              Clear scope
            </button>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
