/**
 * Push execution status + notes from the filesystem INTO the database, overwriting.
 *
 * Run with:
 *   npx ts-node database/src/seed/sync-executions.ts --app eptts-web
 *   npx ts-node database/src/seed/sync-executions.ts --app eptts-web --dry-run
 *   npx ts-node database/src/seed/sync-executions.ts --app eptts-api --environment "ngrok relay"
 *
 * WHY THIS EXISTS SEPARATELY FROM db:import
 *
 * `import.ts` is deliberately insert-only (`insertIfMissing`) so re-running it can never
 * clobber something a human changed in the UI. That is the right default for a backfill —
 * and it means it will never update a status either. After an automation run rewrites
 * `execution-status-v*.json`, the DB still holds the old value and the UI keeps showing
 * stale results.
 *
 * So this script is the explicit, opt-in counterpart: it OVERWRITES. That is destructive to
 * manual UI edits for the app you point it at, which is exactly why it takes a required
 * `--app` and is not wired into any npm alias — you have to mean it.
 *
 * Version resolution mirrors import.ts / src/lib/execution.ts: `execution-status-v<N>.json`
 * maps to version N, and the unsuffixed file maps to the highest existing testcase version
 * (NULL when there is none).
 */
import 'reflect-metadata'
import * as fs from 'fs'
import * as path from 'path'
import { IsNull } from 'typeorm'
import { AppDataSource } from '../data-source'
import { Feature } from '../entities/Feature'
import { TestcaseVersion } from '../entities/TestcaseVersion'
import { TestExecution } from '../entities/TestExecution'

const DATA_ROOT = path.join(__dirname, '..', '..', '..', 'data')

function argValue(flag: string): string | null {
  const i = process.argv.indexOf(flag)
  if (i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) return process.argv[i + 1]
  const inline = process.argv.find((a) => a.startsWith(`${flag}=`))
  return inline ? inline.slice(flag.length + 1) : null
}

const APP = argValue('--app')
/**
 * Which environment's results to sync, e.g. "ngrok relay". Must match the environment's name
 * in the app exactly — it is stored on the row and is what the dashboard filters by.
 *
 * Omitted means the no-environment bucket: the unsuffixed files, and rows with
 * environment IS NULL. The two never mix, so syncing an ngrok run cannot touch a production
 * result for the same case.
 */
const ENVIRONMENT = argValue('--environment')
const DRY_RUN = process.argv.includes('--dry-run')

if (!APP) {
  console.error('required: --app <slug>   (this script OVERWRITES execution rows for that app)')
  process.exit(1)
}

function readJson<T>(p: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8')) as T
  } catch {
    return null
  }
}

interface FileRef { version: number | null; path: string }

/** Filename-safe environment name, matching src/lib/execution.ts's environmentSlug. */
function environmentSlug(environment: string): string {
  return environment.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'env'
}

/**
 * Every `<kind>-v<N>.json` plus the unsuffixed file, which resolves later.
 *
 * With --environment, reads that environment's `--<slug>` variants instead. The two sets are
 * disjoint by construction: the no-environment regex requires `.json` immediately after the
 * version, so it can never match an environment file, and vice versa.
 */
function listFiles(featureDir: string, kind: string): FileRef[] {
  const refs: FileRef[] = []
  const suffix = ENVIRONMENT ? `--${environmentSlug(ENVIRONMENT)}` : ''
  const flat = path.join(featureDir, `${kind}${suffix}.json`)
  if (fs.existsSync(flat)) refs.push({ version: null, path: flat })
  const re = new RegExp(`^${kind}-v(\\d+)${suffix}\\.json$`)
  for (const f of fs.readdirSync(featureDir)) {
    const m = re.exec(f)
    if (m) refs.push({ version: Number(m[1]), path: path.join(featureDir, f) })
  }
  return refs
}

async function main(): Promise<void> {
  await AppDataSource.initialize()
  try {
    const featureRepo = AppDataSource.getRepository(Feature)
    const versionRepo = AppDataSource.getRepository(TestcaseVersion)
    const teRepo = AppDataSource.getRepository(TestExecution)

    const featDir = path.join(DATA_ROOT, APP!, 'features')
    if (!fs.existsSync(featDir)) {
      console.error(`no features directory for app "${APP}" at ${featDir}`)
      process.exitCode = 1
      return
    }

    let updated = 0
    let inserted = 0
    let unchanged = 0
    let noFeature = 0

    for (const entry of fs.readdirSync(featDir, { withFileTypes: true }).filter((e) => e.isDirectory())) {
      const name = entry.name
      const featureDir = path.join(featDir, name)
      const feature = await featureRepo.findOne({ where: { appSlug: APP!, name } })
      if (!feature) { noFeature++; continue }

      // The unsuffixed file belongs to the highest existing testcase version.
      const versions = await versionRepo.find({ where: { feature: { id: feature.id } } })
      const highest = versions.length ? Math.max(...versions.map((v) => v.version)) : null

      const statusFiles = listFiles(featureDir, 'execution-status')
      const noteFiles = listFiles(featureDir, 'execution-notes')

      // Merge status and notes per resolved version before touching the DB, so one testcase
      // is written once rather than twice with a half-applied row in between.
      const merged = new Map<string, Map<string, { status?: string; notes?: string | null }>>()
      const keyOf = (v: number | null) => String(v ?? highest ?? 'null')

      for (const ref of statusFiles) {
        const map = readJson<Record<string, string>>(ref.path)
        if (!map) continue
        const k = keyOf(ref.version)
        if (!merged.has(k)) merged.set(k, new Map())
        for (const [id, status] of Object.entries(map)) {
          if (!id || !status) continue
          const row = merged.get(k)!.get(id) ?? {}
          row.status = status
          merged.get(k)!.set(id, row)
        }
      }
      for (const ref of noteFiles) {
        const map = readJson<Record<string, string>>(ref.path)
        if (!map) continue
        const k = keyOf(ref.version)
        if (!merged.has(k)) merged.set(k, new Map())
        for (const [id, note] of Object.entries(map)) {
          if (!id) continue
          const row = merged.get(k)!.get(id) ?? {}
          row.notes = note || null
          merged.get(k)!.set(id, row)
        }
      }

      for (const [vKey, rows] of merged) {
        const version = vKey === 'null' ? null : Number(vKey)
        const versionWhere = version === null ? IsNull() : version
        const environmentWhere = ENVIRONMENT === null ? IsNull() : ENVIRONMENT

        for (const [testcaseId, next] of rows) {
          const existing = await teRepo.findOne({
            where: {
              feature: { id: feature.id }, version: versionWhere, testcaseId,
              environment: environmentWhere,
            },
          })

          if (!existing) {
            if (!DRY_RUN) {
              await teRepo.save({
                feature: { id: feature.id },
                version,
                testcaseId,
                status: next.status ?? 'new_added',
                notes: next.notes ?? null,
                environment: ENVIRONMENT,
              })
            }
            inserted++
            continue
          }

          const statusChanged = next.status !== undefined && existing.status !== next.status
          // `notes` is only cleared when the file explicitly carries an empty value; a file
          // that simply omits a testcase leaves any existing note alone.
          const notesChanged = next.notes !== undefined && (existing.notes ?? null) !== next.notes

          if (!statusChanged && !notesChanged) { unchanged++; continue }

          const patch: Partial<TestExecution> = {}
          if (statusChanged) patch.status = next.status!
          if (notesChanged) patch.notes = next.notes ?? null
          if (!DRY_RUN) await teRepo.update(existing.id, patch)
          updated++
        }
      }
    }

    console.log(
      `${DRY_RUN ? '[dry run] ' : ''}${APP}: ${updated} updated, ${inserted} inserted, ` +
      `${unchanged} already current` + (noFeature ? `, ${noFeature} dir(s) with no feature row` : ''))
    if (noFeature) console.log('  (run npm run db:import first so the feature rows exist)')
  } finally {
    await AppDataSource.destroy()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
