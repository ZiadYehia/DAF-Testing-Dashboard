/**
 * Server-side persistence for the per-app retest board config. Persisted as a
 * `settings` row (no schema change): <app> BOARD_CONFIG : BoardConfig.
 * Kept separate from `board-config.ts` so typeorm never enters client bundles.
 */
import { getSetting, setSetting } from './settings'
import { DEFAULT_BOARD_CONFIG, normalizeBoardConfig, type BoardConfig } from './board-config'

export async function getBoardConfig(app: string): Promise<BoardConfig> {
  const raw = await getSetting(app, 'BOARD_CONFIG').catch(() => null)
  if (!raw) return DEFAULT_BOARD_CONFIG
  try {
    return normalizeBoardConfig(JSON.parse(raw))
  } catch {
    return DEFAULT_BOARD_CONFIG
  }
}

export async function saveBoardConfig(app: string, cfg: BoardConfig): Promise<void> {
  await setSetting(app, 'BOARD_CONFIG', JSON.stringify(cfg))
}
