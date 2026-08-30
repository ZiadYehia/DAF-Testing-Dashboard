'use client'

import { useState } from 'react'
import { CheckCircle2, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  DEFAULT_JIRA_FIELD_SYNC,
  JIRA_SYNC_FIELDS,
  BUG_TYPE_OPTIONS,
  type BugVariantConfig,
  type JiraFieldSyncConfig,
  type JiraSyncFieldKey,
} from '@/lib/bug-format'
import { ChipListEditor, GroupLabel } from '@/components/settings/fields'

export const BUG_VARIANT_CORE_FIELDS = ['Title', 'Summary', 'Steps to Reproduce', 'Expected Result', 'Actual Result']

export const BUG_VARIANT_OPTIONAL_FIELDS: { key: keyof BugVariantConfig['fields']; label: string }[] = [
  { key: 'environment', label: 'Environment' },
  { key: 'priority', label: 'Priority' },
  { key: 'severity', label: 'Severity' },
  { key: 'bugType', label: 'Bug Type' },
]

/**
 * One field's "sync this to a Jira custom field" editor: enable toggle, field-ID
 * input, "Fetch options" (pulls Jira's real allowed values via createmeta), and a
 * per-value mapping dropdown once options are fetched. Fully generic over which
 * bug field it's editing — driven by `JIRA_SYNC_FIELDS` — so a new syncable field
 * is a registry entry, not a new copy of this component.
 */
interface JiraFieldSyncEditorProps {
  app: string
  variant: 'epic' | 'story'
  fieldKey: JiraSyncFieldKey
  label: string
  /** This field's acceptable values (e.g. severityOptions, or the fixed BUG_TYPE_OPTIONS list). */
  options: string[]
  value: JiraFieldSyncConfig
  onChange: (updater: (prev: JiraFieldSyncConfig) => JiraFieldSyncConfig) => void
  /**
   * "Fetch options" endpoint base, e.g. `bug-format` or `cr-format` — each format's
   * options route resolves Jira's allowed values against its own issue types, since
   * a bug and a CR filed under the same parent are different Jira issue types.
   */
  optionsEndpoint?: string
}

export function JiraFieldSyncEditor({
  app,
  variant,
  fieldKey,
  label,
  options,
  value,
  onChange,
  optionsEndpoint = 'bug-format',
}: JiraFieldSyncEditorProps) {
  const [jiraOptions, setJiraOptions] = useState<{ id: string; value: string }[] | null>(null)
  const [fetchingOptions, setFetchingOptions] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  async function fetchJiraOptions() {
    if (!value.jiraFieldId) return
    setFetchingOptions(true)
    setFetchError(null)
    try {
      const res = await fetch(
        `/api/${app}/${optionsEndpoint}/jira-field-options?fieldId=${encodeURIComponent(value.jiraFieldId)}&variant=${variant}&parentType=${variant}`
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to fetch Jira field options')
      const fetched: { id: string; value: string }[] = data.options ?? []
      setJiraOptions(fetched)
      if (fetched.length === 0) {
        setFetchError('Jira returned no options for this field — is it really a select-list field?')
      }
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to fetch Jira field options')
      setJiraOptions(null)
    } finally {
      setFetchingOptions(false)
    }
  }

  return (
    <div className="space-y-1.5 border-t pt-4">
      <GroupLabel>{label} → Jira</GroupLabel>
      <div className="flex items-center gap-3">
        <label className="flex shrink-0 items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={value.enabled}
            onChange={() => onChange((prev) => ({ ...prev, enabled: !prev.enabled }))}
            className="h-4 w-4 accent-primary"
          />
          Send {label.toLowerCase()} as a Jira field
        </label>
        <Input
          value={value.jiraFieldId}
          onChange={(e) => {
            onChange(() => ({ enabled: value.enabled, jiraFieldId: e.target.value, valueMap: {} }))
            setJiraOptions(null)
            setFetchError(null)
          }}
          placeholder="customfield_10321"
          className="h-9 flex-1 font-mono text-sm"
          disabled={!value.enabled}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 shrink-0 gap-1.5"
          disabled={!value.enabled || !value.jiraFieldId || fetchingOptions}
          onClick={fetchJiraOptions}
        >
          {fetchingOptions ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Fetch options
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Turn on once the {label} field exists in Jira, set its custom field ID above, then fetch Jira&apos;s real
        options and map each of your {label.toLowerCase()} values below — Jira&apos;s option text (e.g. &quot;🟡
        Moderate&quot;) rarely matches yours verbatim.
      </p>
      {fetchError && <p className="text-xs text-destructive">{fetchError}</p>}
      {jiraOptions && jiraOptions.length > 0 && (
        <div className="space-y-1.5 rounded-lg border p-3">
          {options.map((optionValue) => (
            <div key={optionValue} className="flex items-center gap-2">
              <span className="w-40 shrink-0 truncate text-sm">{optionValue}</span>
              <Select
                value={value.valueMap[optionValue] ?? ''}
                onValueChange={(id) =>
                  onChange((prev) => ({
                    ...prev,
                    valueMap: id
                      ? { ...prev.valueMap, [optionValue]: id }
                      : Object.fromEntries(Object.entries(prev.valueMap).filter(([k]) => k !== optionValue)),
                  }))
                }
              >
                <SelectTrigger className="h-8 flex-1 text-sm">
                  <SelectValue placeholder="— not mapped —" />
                </SelectTrigger>
                <SelectContent>
                  {jiraOptions.map((opt) => (
                    <SelectItem key={opt.id} value={opt.id}>
                      {opt.value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface BugVariantSectionProps {
  description: string
  /** Which variant this section edits — used only to word the "other tab" label hint. */
  variant: 'epic' | 'story'
  app: string
  config: BugVariantConfig
  /** Shared severity value list (same for epic/story) — mapped per-variant since the Jira field id can differ. */
  severityOptions: string[]
  onChange: (updater: (prev: BugVariantConfig) => BugVariantConfig) => void
}

export function BugVariantSection({ description, variant, app, config, severityOptions, onChange }: BugVariantSectionProps) {
  const otherVariantLabel = variant === 'epic' ? 'Story' : 'Epic'

  function toggleField(field: keyof BugVariantConfig['fields']) {
    onChange((prev) => ({ ...prev, fields: { ...prev.fields, [field]: !prev.fields[field] } }))
  }

  function optionsForField(key: JiraSyncFieldKey): string[] {
    return key === 'severity' ? severityOptions : BUG_TYPE_OPTIONS
  }

  return (
    <div className="space-y-5 pt-4">
      <p className="text-xs text-muted-foreground">{description}</p>

      {/* Fields */}
      <div className="space-y-2.5">
        <GroupLabel>Fields</GroupLabel>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          Always included: {BUG_VARIANT_CORE_FIELDS.join(' · ')}
        </p>
        <div className="flex flex-wrap gap-2">
          {BUG_VARIANT_OPTIONAL_FIELDS.map(({ key, label }) => {
            const checked = config.fields[key]
            return (
              <label
                key={key}
                className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  checked
                    ? 'border-primary/40 bg-primary/10 text-foreground'
                    : 'border-input text-muted-foreground hover:bg-muted/50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleField(key)}
                  className="h-4 w-4 accent-primary"
                />
                {label}
              </label>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Disabled fields are removed from the AI prompt, the bug form, and the report body.
        </p>
      </div>

      {/* Jira labels */}
      <div className="space-y-1.5 border-t pt-4">
        <GroupLabel>Jira labels</GroupLabel>
        <p className="text-xs text-muted-foreground">
          Pre-checked when reporting to Jira, in addition to the always-sent BUG label. No spaces (Jira restriction).
        </p>
        <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
          These labels apply to {variant === 'epic' ? 'Epic' : 'Story'} bugs only — the {otherVariantLabel} tab has its own separate list.
        </p>
        <ChipListEditor
          items={config.jiraLabels}
          onAdd={(label) =>
            onChange((prev) => (prev.jiraLabels.includes(label) ? prev : { ...prev, jiraLabels: [...prev.jiraLabels, label] }))
          }
          onRemove={(label) => onChange((prev) => ({ ...prev, jiraLabels: prev.jiraLabels.filter((l) => l !== label) }))}
          placeholder="e.g. regression"
          disallowSpaces
        />
      </div>

      {/* Field -> Jira syncs (severity, bug type, ...) — one registry entry each, see JIRA_SYNC_FIELDS */}
      {JIRA_SYNC_FIELDS.map(({ key, label }) => (
        <JiraFieldSyncEditor
          key={key}
          app={app}
          variant={variant}
          fieldKey={key}
          label={label}
          options={optionsForField(key)}
          value={config.jiraFieldSyncs[key] ?? DEFAULT_JIRA_FIELD_SYNC}
          onChange={(updater) =>
            onChange((prev) => ({
              ...prev,
              jiraFieldSyncs: { ...prev.jiraFieldSyncs, [key]: updater(prev.jiraFieldSyncs[key] ?? DEFAULT_JIRA_FIELD_SYNC) },
            }))
          }
        />
      ))}
    </div>
  )
}
