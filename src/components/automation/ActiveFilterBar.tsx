import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ActiveFilter {
  key: string
  label: string
  onRemove: () => void
}

// One-line summary of every active filter, so the three pill rows above it
// don't have to be scanned just to see what's currently narrowing the list.
export function ActiveFilterBar({
  filters,
  onClearAll,
}: {
  filters: ActiveFilter[]
  onClearAll: () => void
}): React.ReactElement | null {
  // No active filters — don't reserve a row for an empty summary.
  if (filters.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-1 px-0.5">
      {filters.map((f) => (
        <button
          key={f.key}
          onClick={f.onRemove}
          title={`Remove filter: ${f.label}`}
          className={cn(
            'inline-flex items-center gap-1 rounded-full bg-muted/70 px-2 py-0.5',
            'text-[10px] text-muted-foreground hover:text-foreground',
          )}
        >
          {f.label}
          <X className="h-2.5 w-2.5" />
        </button>
      ))}
      {filters.length > 1 && (
        <button
          onClick={onClearAll}
          className="text-[10px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Clear all
        </button>
      )}
    </div>
  )
}
