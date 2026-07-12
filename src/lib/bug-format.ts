/**
 * Per-app configurable bug format — client-safe constants only.
 * Must NOT import settings/db/fs/typeorm: this module is imported by client
 * components (bug dialogs, settings UI) and would otherwise pull the DB layer
 * into the browser bundle. See `bug-format-server.ts` for the persisted config.
 */

export type BugLayer = 'frontend' | 'backend' | 'unknown'

/** EPIC bugs have no parent story; STORY bugs are linked to a parent story key. */
export type BugVariant = 'epic' | 'story'

/** Bug fields that can optionally be pushed to a Jira *custom* select field (system fields like Priority have their own fixed mapping and don't go through this). */
export type JiraSyncFieldKey = 'severity' | 'bugType'

export interface JiraFieldSyncConfig {
  /** User toggles ON once the matching custom field exists in Jira. */
  enabled: boolean
  /** e.g. 'customfield_10321' */
  jiraFieldId: string
  /** Our option value (e.g. "S3 – Moderate") -> Jira select option id, fetched + mapped in Settings. */
  valueMap: Record<string, string>
}

export const DEFAULT_JIRA_FIELD_SYNC: JiraFieldSyncConfig = {
  enabled: false,
  jiraFieldId: '',
  valueMap: {},
}

/**
 * Registry of bug fields eligible for Jira custom-field sync. Adding a new
 * syncable field is one entry here (plus reading it off `BugDetail` in
 * jira.ts) — no new config props, API route, or Settings UI block needed.
 */
export const JIRA_SYNC_FIELDS: { key: JiraSyncFieldKey; label: string; bugField: 'severity' | 'bug_type' }[] = [
  { key: 'severity', label: 'Severity', bugField: 'severity' },
  { key: 'bugType', label: 'Bug Type', bugField: 'bug_type' },
]

/** The value list a sync field's options are drawn from — editable for severity, fixed for bug type. */
export function optionsForSyncField(fmt: BugFormatConfig, key: JiraSyncFieldKey): string[] {
  return key === 'severity' ? fmt.severityOptions : BUG_TYPE_OPTIONS
}

export interface BugVariantConfig {
  fields: {
    environment: boolean
    priority: boolean
    bugType: boolean
    severity: boolean
  }
  /** Extra Jira labels offered at report time. Base 'BUG' label is implicit and always sent. */
  jiraLabels: string[]
  /** Per-field Jira custom-field sync config, keyed by JiraSyncFieldKey. Absent key = not configured. */
  jiraFieldSyncs: Partial<Record<JiraSyncFieldKey, JiraFieldSyncConfig>>
}

export interface BugFormatConfig {
  /** Settings for bugs reported directly under an epic (no parent_key). */
  epic: BugVariantConfig
  /** Settings for bugs linked to a parent story (has parent_key). */
  story: BugVariantConfig
  /** Editable acceptable Priority values; default = DEFAULT_PRIORITY_OPTIONS. */
  priorityOptions: string[]
  /** Editable acceptable Severity values; default = DEFAULT_SEVERITY_OPTIONS. */
  severityOptions: string[]
}

// Canonical option lists — keep the exact existing en/em-dash strings, since
// these are the stored values (changing them would silently orphan old bugs).
export const DEFAULT_PRIORITY_OPTIONS = ['P1 – Critical', 'P2 – High', 'P3 – Medium', 'P4 – Low']

export const BUG_TYPE_OPTIONS = [
  'Functional',
  'Functional / Validation',
  'Functional (Backend/API)',
  'Functional — Intermittent / Flaky',
  'Access Control / Security',
  'UI/UX',
  'Design / Mockup Inconsistency',
  'AC Gap',
  'Spec Ambiguity',
]

export const DEFAULT_SEVERITY_OPTIONS = ['S1 – Critical', 'S2 – High', 'S3 – Medium', 'S4 – Low']

export const LAYER_OPTIONS: { value: BugLayer; label: string }[] = [
  { value: 'frontend', label: 'Frontend' },
  { value: 'backend', label: 'Backend' },
  { value: 'unknown', label: 'Unknown' },
]

export const DEFAULT_BUG_VARIANT: BugVariantConfig = {
  fields: { environment: true, priority: true, bugType: true, severity: false },
  jiraLabels: [],
  jiraFieldSyncs: {},
}

export const DEFAULT_BUG_FORMAT: BugFormatConfig = {
  epic: DEFAULT_BUG_VARIANT,
  story: DEFAULT_BUG_VARIANT,
  priorityOptions: DEFAULT_PRIORITY_OPTIONS,
  severityOptions: DEFAULT_SEVERITY_OPTIONS,
}

/** Which config variant applies to a bug, based on its parent story link. */
export function variantForParentKey(parentKey: string | null | undefined): BugVariant {
  return parentKey ? 'story' : 'epic'
}

/** The variant config that applies to a bug with the given parent_key. */
export function getVariantConfig(
  config: BugFormatConfig,
  parentKey: string | null | undefined
): BugVariantConfig {
  return config[variantForParentKey(parentKey)]
}

/** Jira issue summary prefix by layer classification. */
export function jiraSummaryForBug(layer: string | null | undefined, title: string): string {
  const prefix = layer === 'frontend' ? 'BUG (FE): ' : layer === 'backend' ? 'BUG (BE): ' : 'BUG: '
  return prefix + title
}
