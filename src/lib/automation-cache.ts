// Renders data/<slug>/automation.json from the automation_configs DB row — the
// file automation-hub/lib/apps.ts scans at startup. No-op (skip silently) when
// an app has no DB row yet, so apps still relying purely on a hand-written or
// intake-compiled file are left untouched.
import fs from 'fs'
import path from 'path'
import { getDataRoot } from './paths'
import { getDataSource } from './db'
import { AutomationConfigEntity, IAutomationConfig } from './entities'

function safeJsonArray(json: string): unknown[] {
  try {
    const parsed = JSON.parse(json)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** Render one app's automation.json cache from its automation_configs row. No-op if no row exists. */
export async function writeAutomationCache(appSlug: string): Promise<void> {
  const ds = await getDataSource()
  const row = await ds.getRepository<IAutomationConfig>(AutomationConfigEntity).findOne({ where: { appSlug } })
  if (!row) return

  const config = {
    slug: appSlug,
    baseUrlEnv: row.baseUrlEnv,
    credentialEnvs: safeJsonArray(row.credentialEnvs),
    login: safeJsonArray(row.login),
    _generatedFromIntake: row.generatedFromIntake,
    _derivedCache: true,
  }

  const filePath = path.join(getDataRoot(), appSlug, 'automation.json')
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf-8')
}

/** Regenerate every app's automation.json cache from automation_configs. Called
 *  before a regression run spawns child processes so the hub's file-based
 *  registry reflects the DB even when the file wasn't the last thing touched. */
export async function writeAllAutomationCaches(): Promise<void> {
  const ds = await getDataSource()
  const rows = await ds.getRepository<IAutomationConfig>(AutomationConfigEntity).find()
  for (const row of rows) {
    await writeAutomationCache(row.appSlug)
  }
}
