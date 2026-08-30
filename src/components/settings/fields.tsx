'use client'

import { useState, type ReactNode } from 'react'
import { Eye, EyeOff, CheckCircle2, XCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

// ─── Shared props ─────────────────────────────────────────────────────────────

/** Shared global-settings plumbing handed to any tab that edits `/api/settings` keys. */
export interface GlobalKeysProps {
  globals: Record<string, string>
  loading: boolean
  onChange: (key: string, value: string) => void
  saveKeys: (keys: string[], setSaving: (v: boolean) => void) => Promise<void>
}

// ─── Sub-components ───────────────────────────────────────────────────────────

export function StatusBadge({ value }: { value: string }) {
  if (value) {
    return (
      <Badge variant="outline" className="gap-1 text-xs text-emerald-600 border-emerald-200 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:bg-emerald-950/30">
        <CheckCircle2 className="h-3 w-3" />
        Configured
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="gap-1 text-xs text-muted-foreground">
      <XCircle className="h-3 w-3" />
      Not set
    </Badge>
  )
}

interface CredentialRowProps {
  label: string
  description?: string
  fieldKey: string
  value: string
  onChange: (key: string, value: string) => void
  type?: 'text' | 'password'
}

export function CredentialRow({ label, description, fieldKey, value, onChange, type = 'password' }: CredentialRowProps) {
  const [revealed, setRevealed] = useState(false)
  const isPassword = type === 'password'

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <label className="text-sm font-medium">{label}</label>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        <StatusBadge value={value} />
      </div>
      <div className="flex gap-2">
        <Input
          type={isPassword && !revealed ? 'password' : 'text'}
          value={value}
          onChange={(e) => onChange(fieldKey, e.target.value)}
          placeholder={isPassword ? '••••••••••••••••' : `Enter ${label}`}
          className="font-mono text-sm h-9"
        />
        {isPassword && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => setRevealed((r) => !r)}
            title={revealed ? 'Hide' : 'Reveal'}
          >
            {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        )}
      </div>
    </div>
  )
}

interface ChipListEditorProps {
  items: string[]
  onAdd: (value: string) => void
  onRemove: (value: string) => void
  placeholder?: string
  disallowSpaces?: boolean
}

export function ChipListEditor({ items, onAdd, onRemove, placeholder, disallowSpaces }: ChipListEditorProps) {
  const [input, setInput] = useState('')

  function handleAdd() {
    const value = input.trim()
    if (!value) return
    if (disallowSpaces && /\s/.test(value)) return
    onAdd(value)
    setInput('')
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleAdd()
            }
          }}
          placeholder={placeholder}
          className="h-9"
        />
        <Button type="button" variant="outline" onClick={handleAdd} className="shrink-0">
          Add
        </Button>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-1 rounded-full border bg-muted px-2.5 py-1 text-xs font-medium"
            >
              {item}
              <button
                type="button"
                onClick={() => onRemove(item)}
                className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                aria-label={`Remove ${item}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export function GroupLabel({ children }: { children: ReactNode }) {
  return <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{children}</p>
}
