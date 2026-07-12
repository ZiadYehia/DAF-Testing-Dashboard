'use client'

interface LabelMultiSelectProps {
  /** Full set of extra Jira labels offered (from the app's bug-format config). */
  labels: string[]
  /** Currently checked labels. */
  selected: string[]
  onChange: (selected: string[]) => void
  disabled?: boolean
}

/**
 * Pre-checked checkbox group for the extra Jira labels offered at report time.
 * The base 'BUG' label is always sent by the server regardless of this selection,
 * so it isn't listed here — only the app's configurable extra labels are.
 */
export function LabelMultiSelect({ labels, selected, onChange, disabled }: LabelMultiSelectProps) {
  if (labels.length === 0) return null

  const toggle = (label: string) => {
    if (selected.includes(label)) onChange(selected.filter((l) => l !== label))
    else onChange([...selected, label])
  }

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">Jira labels</label>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {labels.map((label) => (
          <label key={label} className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={selected.includes(label)}
              onChange={() => toggle(label)}
              disabled={disabled}
              className="h-4 w-4 accent-primary"
            />
            {label}
          </label>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Base label BUG is always added.</p>
    </div>
  )
}
