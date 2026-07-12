/**
 * Per-app configurable retest board — client-safe constants only.
 * Must NOT import settings/db/fs/typeorm: this module is imported by client
 * components (board page, settings UI) and would otherwise pull the DB layer
 * into the browser bundle. See `board-config-server.ts` for the persisted config.
 */

export interface BoardConfig {
  /** Jira status names shown as board columns, in display order. Empty = board unconfigured. */
  columns: string[]
  /** The Jira status whose column is highlighted as "to retest". Must be one of `columns`. */
  retestStatus: string | null
  /** Show a leading synthetic column for draft bugs that have no Jira issue yet. */
  showDraftColumn: boolean
}

export const DEFAULT_BOARD_CONFIG: BoardConfig = {
  columns: [],
  retestStatus: null,
  showDraftColumn: true,
}

/** Coerce an unknown parsed JSON value into a valid BoardConfig. */
export function normalizeBoardConfig(raw: unknown): BoardConfig {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_BOARD_CONFIG
  const obj = raw as Partial<BoardConfig>
  const columns = Array.isArray(obj.columns)
    ? obj.columns.filter((c): c is string => typeof c === 'string' && c.trim() !== '')
    : []
  const retestStatus =
    typeof obj.retestStatus === 'string' && columns.includes(obj.retestStatus)
      ? obj.retestStatus
      : null
  return {
    columns,
    retestStatus,
    showDraftColumn: typeof obj.showDraftColumn === 'boolean' ? obj.showDraftColumn : true,
  }
}
