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
} from '@/components/ui/dropdown-menu'

// Level-3 "Refine" disclosure for the tag row — one app carries 36 tags, too
// many to keep as a pill row, so they live behind a single trigger instead.
export function TagPopover({
  tags,
  selected,
  onToggle,
  onClear,
}: {
  tags: { name: string; count: number }[]
  selected: string[]
  onToggle: (tag: string) => void
  onClear: () => void
}): React.ReactElement | null {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')

  // Nothing to refine and nothing selected — don't reserve space for an empty control.
  if (tags.length === 0 && selected.length === 0) return null

  const q = query.trim().toLowerCase()
  const filtered = q ? tags.filter((t) => t.name.toLowerCase().includes(q)) : tags

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setQuery('')
      }}
    >
      <DropdownMenuTrigger
        title="Filter by tag"
        className={cn(
          'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors',
          selected.length > 0
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-border/60 text-muted-foreground hover:border-primary/50 hover:text-foreground',
        )}
      >
        {selected.length > 0 ? `Tags · ${selected.length}` : 'Tags'}
        <ChevronDown className="h-3 w-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 p-2">
        <div className="relative mb-1.5">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            // The menu's typeahead/composite navigation listens for keydown on
            // this popup and would otherwise swallow every keystroke typed here.
            onKeyDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            placeholder="Filter tags…"
            className="h-7 pl-6 text-xs"
          />
        </div>
        <div className="max-h-64 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-1.5 py-2 text-center text-xs text-muted-foreground">No tags match</div>
          ) : (
            filtered.map((t) => (
              <DropdownMenuCheckboxItem
                key={t.name}
                checked={selected.includes(t.name)}
                onCheckedChange={() => onToggle(t.name)}
                className="justify-between"
              >
                <span className="truncate">{t.name}</span>
                <span className="ml-2 shrink-0 text-muted-foreground">{t.count}</span>
              </DropdownMenuCheckboxItem>
            ))
          )}
        </div>
        {selected.length > 0 && (
          <button
            onClick={onClear}
            className="mt-1 w-full rounded-md px-1.5 py-1 text-left text-[11px] text-muted-foreground hover:text-foreground"
          >
            Clear tags
          </button>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
