'use client'

import { CheckCircle2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { DEFAULT_JIRA_FIELD_SYNC, type JiraSyncFieldKey } from '@/lib/bug-format'
import type { CrParentType, CrVariant } from '@/lib/cr-format'
import { ChipListEditor, GroupLabel } from '@/components/settings/fields'
import { JiraFieldSyncEditor } from '@/components/settings/BugVariantSection'

export const CR_VARIANT_CORE_FIELDS = ['Summary', 'Description']

export const CR_VARIANT_OPTIONAL_FIELDS: { key: keyof CrVariant['fields']; label: string }[] = [
  { key: 'changeType', label: 'Change Type' },
  { key: 'priority', label: 'Priority' },
]

/**
 * A change request has one dynamic value worth syncing to a Jira custom field
 * (the change type itself), rather than one bug field per sync key — so it
 * borrows a single slot from the same `JiraSyncFieldKey` registry bug format
 * uses. Which literal key is irrelevant: `buildCrSyncedFields` in `jira.ts`
 * applies the change-type value to whichever sync entries are enabled.
 */
const CR_SYNC_KEY: JiraSyncFieldKey = 'severity'

interface CrVariantSectionProps {
  description: string
  /** Which variant this section edits — a CR under a story (sub-task) or under an epic (story). */
  variant: CrParentType
  app: string
  config: CrVariant
  /** Shared change-type value list (same for story/epic) — mapped per-variant since the Jira field id can differ. */
  changeTypes: string[]
  /** Placeholder shown when this variant has no issue-type override — the effective default from Settings → Jira Issue Types. */
  defaultIssueType: string
  onChange: (updater: (prev: CrVariant) => CrVariant) => void
}

export function CrVariantSection({
  description,
  variant,
  app,
  config,
  changeTypes,
  defaultIssueType,
  onChange,
}: CrVariantSectionProps) {
  const otherVariantLabel = variant === 'epic' ? 'Story' : 'Epic'

  function toggleField(field: keyof CrVariant['fields']) {
    onChange((prev) => ({ ...prev, fields: { ...prev.fields, [field]: !prev.fields[field] } }))
  }

  return (
    <div className="space-y-5 pt-4">
      <p className="text-xs text-muted-foreground">{description}</p>

      {/* Issue type override */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Jira Issue Type</label>
        <p className="text-xs text-muted-foreground">
          Leave blank to use the default configured in Settings → Jira Issue Types below (
          <code className="text-xs">{defaultIssueType}</code>).
        </p>
        <Input
          value={config.issueType}
          onChange={(e) => onChange((prev) => ({ ...prev, issueType: e.target.value }))}
          placeholder={defaultIssueType}
          className="h-9 font-mono text-sm"
        />
      </div>

      {/* Fields */}
      <div className="space-y-2.5">
        <GroupLabel>Fields</GroupLabel>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          Always included: {CR_VARIANT_CORE_FIELDS.join(' · ')}
        </p>
        <div className="flex flex-wrap gap-2">
          {CR_VARIANT_OPTIONAL_FIELDS.map(({ key, label }) => {
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
          Disabled fields are removed from the AI prompt and the CR form.
        </p>
      </div>

      {/* Jira labels */}
      <div className="space-y-1.5 border-t pt-4">
        <GroupLabel>Jira labels</GroupLabel>
        <p className="text-xs text-muted-foreground">
          Pre-checked when filing the change request in Jira, in addition to the always-sent CR label. No spaces
          (Jira restriction).
        </p>
        <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
          These labels apply to CRs filed under a {variant === 'epic' ? 'an epic' : 'a story'} only — the{' '}
          {otherVariantLabel} tab has its own separate list.
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

      {/* Change type -> Jira custom field sync */}
      <JiraFieldSyncEditor
        app={app}
        variant={variant}
        fieldKey={CR_SYNC_KEY}
        label="Change Type"
        options={changeTypes}
        value={config.jiraFieldSyncs[CR_SYNC_KEY] ?? DEFAULT_JIRA_FIELD_SYNC}
        optionsEndpoint="cr-format"
        onChange={(updater) =>
          onChange((prev) => ({
            ...prev,
            jiraFieldSyncs: {
              ...prev.jiraFieldSyncs,
              [CR_SYNC_KEY]: updater(prev.jiraFieldSyncs[CR_SYNC_KEY] ?? DEFAULT_JIRA_FIELD_SYNC),
            },
          }))
        }
      />
    </div>
  )
}
