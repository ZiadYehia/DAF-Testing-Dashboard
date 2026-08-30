/**
 * Per-app configurable change-request (CR) format — client-safe constants
 * only. Must NOT import settings/db/fs/typeorm: this module is imported by
 * client components (CR dialogs, settings UI) and would otherwise pull the
 * DB layer into the browser bundle. See `cr-format-server.ts` for the
 * persisted config.
 */
import type { JiraFieldSyncConfig, JiraSyncFieldKey } from './bug-format'

/** A CR is filed against a parent story (Jira sub-task) or a parent epic (Jira story). */
export type CrParentType = 'story' | 'epic'

export interface CrVariant {
  issueType: string
  fields: {
    changeType: boolean
    priority: boolean
  }
  /** Extra Jira labels offered at report time. Base 'CR' label is implicit and always sent. */
  jiraLabels: string[]
  /** Per-field Jira custom-field sync config, keyed by JiraSyncFieldKey — same shape bug format uses. */
  jiraFieldSyncs: Partial<Record<JiraSyncFieldKey, JiraFieldSyncConfig>>
}

export interface CrFormatConfig {
  /** Prefixed onto the Jira summary, e.g. "CR: <summary>". */
  summaryPrefix: string
  /** Base Jira label always sent with a CR (analogous to the implicit 'BUG' label). */
  label: string
  /** Editable list of acceptable change-type values. */
  changeTypes: string[]
  /** Settings for CRs filed under a parent story (Jira sub-task). */
  story: CrVariant
  /** Settings for CRs filed under a parent epic (Jira story). */
  epic: CrVariant
}

export const DEFAULT_CHANGE_TYPES = ['Scope add', 'Scope remove', 'Acceptance criteria change', 'Clarification', 'Other']

export const DEFAULT_CR_VARIANT: CrVariant = {
  // Left blank: the server fills the actual Jira issue type from per-app
  // settings (jiraCrSubtaskIssueType / jiraCrStoryIssueType).
  issueType: '',
  fields: { changeType: true, priority: true },
  jiraLabels: ['CR'],
  jiraFieldSyncs: {},
}

export const DEFAULT_CR_FORMAT: CrFormatConfig = {
  summaryPrefix: 'CR: ',
  label: 'CR',
  changeTypes: DEFAULT_CHANGE_TYPES,
  story: DEFAULT_CR_VARIANT,
  epic: DEFAULT_CR_VARIANT,
}

/** The variant config that applies to a CR with the given parent type. */
export function getCrVariantConfig(config: CrFormatConfig, parentType: CrParentType): CrVariant {
  return config[parentType]
}
