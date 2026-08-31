/**
 * Re-scope a set of features (and their module) from one app to another.
 *
 * Run with:
 *   npx ts-node database/src/seed/move-app-scope.ts \
 *     --from eptts-web --to eptts-api \
 *     --features api-authentication,api-commission,... --module eptts-apis \
 *     [--copy-memberships] [--dry-run]
 *
 * Rollback is the same command with --from and --to swapped. That symmetry is the whole
 * reason they are parameters rather than constants.
 *
 * WHY UPDATE RATHER THAN RE-IMPORT
 *
 * `features.appSlug` is a denormalized plain column, but the rows carrying a feature's
 * actual value — testcase_versions, test_executions (status AND notes), acceptance_criteria,
 * screenshots, approved_examples — hang off `featureId`. So one UPDATE of appSlug carries
 * all of them, with nothing re-derived and nothing re-parsed.
 *
 * The alternative (move the files and let `db:import` pick them up under the new app) looks
 * equivalent and is not: the importer finds no row for the new (appSlug, name) pair and
 * INSERTs a duplicate feature with a fresh featureId, leaving every recorded execution
 * orphaned on the old one. There is no clean repair for that, which is why this tool exists.
 *
 * WHAT IT DELIBERATELY DOES NOT TOUCH
 *
 *   - `bugs.module` — that column holds the module's *pathPrefix*, not its slug (see
 *     resolveBugModule in import.ts). The module keeps both, so it stays correct.
 *   - `automation_configs` — the source app keeps its browser login config; an API app has
 *     none by design.
 *   - `story_links`, `user_stories`, `change_requests` — reported, never moved. They are
 *     app-scoped but not feature-scoped, so which app they belong to is a judgement call.
 */
import 'reflect-metadata'
import { AppDataSource } from '../data-source'

function argValue(flag: string): string | null {
  const i = process.argv.indexOf(flag)
  if (i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) return process.argv[i + 1]
  const inline = process.argv.find((a) => a.startsWith(`${flag}=`))
  return inline ? inline.slice(flag.length + 1) : null
}

const FROM = argValue('--from')
const TO = argValue('--to')
const MODULE = argValue('--module')
const FEATURES = (argValue('--features') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
const DRY_RUN = process.argv.includes('--dry-run')
const COPY_MEMBERSHIPS = process.argv.includes('--copy-memberships')

if (!FROM || !TO || FEATURES.length === 0) {
  console.error(
    'required: --from <slug> --to <slug> --features <a,b,c> [--module <slug>] ' +
    '[--copy-memberships] [--dry-run]',
  )
  process.exit(1)
}
if (FROM === TO) {
  console.error('--from and --to must differ')
  process.exit(1)
}

/**
 * mssql binds positionally as @0, @1, … so an IN list has to be built to match wherever the
 * feature names land in the params array. `offset` is how many params precede them.
 */
function inList(offset: number, count: number): string {
  return Array.from({ length: count }, (_, i) => `@${offset + i}`).join(', ')
}

async function main(): Promise<void> {
  await AppDataSource.initialize()
  const runner = AppDataSource.createQueryRunner()
  await runner.connect()

  const F = FEATURES.length
  const q = (sql: string, params: unknown[]) => runner.query(sql, params)
  const count = async (sql: string, params: unknown[]): Promise<number> => {
    const rows = await q(sql, params)
    return Number(rows[0]?.n ?? 0)
  }

  try {
    // Recorded before anything changes: if a stray `db:import` ever inserts duplicate
    // feature rows, "delete where id > this" is the only way back.
    const maxIdBefore = await count('SELECT MAX(id) AS n FROM features', [])
    console.log(`MAX(features.id) before any change: ${maxIdBefore}`)

    // ── pre-flight: would the destination collide? ────────────────────────────
    // features UNIQUE(appSlug, name) would abort the transaction part-way. Refuse first,
    // so a problem is found before 15 directories have been moved on disk.
    const collisions: { name: string }[] = await q(
      `SELECT name FROM features WHERE appSlug = @0 AND name IN (${inList(1, F)})`,
      [TO, ...FEATURES],
    )
    if (collisions.length) {
      console.error(`REFUSING: "${TO}" already has feature(s): ${collisions.map((r) => r.name).join(', ')}`)
      process.exitCode = 1
      return
    }

    // ── what is in scope (measured before the writes, so dry-run and real agree) ──
    const scope: Record<string, number> = {
      features: await count(
        `SELECT COUNT(*) AS n FROM features WHERE appSlug = @0 AND name IN (${inList(1, F)})`, [FROM, ...FEATURES]),
      bugs: await count(
        `SELECT COUNT(*) AS n FROM bugs WHERE appSlug = @0 AND feature IN (${inList(1, F)})`, [FROM, ...FEATURES]),
      intake_documents: await count(
        `SELECT COUNT(*) AS n FROM intake_documents WHERE appSlug = @0 AND scopeKind = 'feature'
           AND scopeSlug IN (${inList(1, F)})`, [FROM, ...FEATURES]),
    }
    if (MODULE) {
      scope.modules = await count('SELECT COUNT(*) AS n FROM modules WHERE appSlug = @0 AND slug = @1', [FROM, MODULE])
      scope.knowledge_files = await count('SELECT COUNT(*) AS n FROM knowledge_files WHERE appSlug = @0 AND module = @1', [FROM, MODULE])
      scope.requirements = await count('SELECT COUNT(*) AS n FROM requirements WHERE appSlug = @0 AND module = @1', [FROM, MODULE])
    }

    // Rows that ride along on featureId — reported so the blast radius is visible.
    const carried = {
      executions: await count(
        `SELECT COUNT(*) AS n FROM test_executions te JOIN features f ON f.id = te.featureId
           WHERE f.appSlug = @0 AND f.name IN (${inList(1, F)})`, [FROM, ...FEATURES]),
      versions: await count(
        `SELECT COUNT(*) AS n FROM testcase_versions tv JOIN features f ON f.id = tv.featureId
           WHERE f.appSlug = @0 AND f.name IN (${inList(1, F)})`, [FROM, ...FEATURES]),
      screenshots: await count(
        `SELECT COUNT(*) AS n FROM screenshots s JOIN features f ON f.id = s.featureId
           WHERE f.appSlug = @0 AND f.name IN (${inList(1, F)})`, [FROM, ...FEATURES]),
    }

    // Report-only: app-scoped but not feature-scoped.
    for (const table of ['story_links', 'user_stories', 'change_requests']) {
      const n = await count(`SELECT COUNT(*) AS n FROM ${table} WHERE appSlug = @0`, [FROM])
      if (n) console.log(`  note: ${n} ${table} row(s) on "${FROM}" — NOT moved (review manually)`)
    }

    console.log(`\n${DRY_RUN ? '[dry run] ' : ''}${FROM} → ${TO}`)
    for (const [k, v] of Object.entries(scope)) console.log(`  ${k.padEnd(18)} ${v} row(s) to re-scope`)
    console.log(`  — carried via featureId: ${carried.executions} execution(s), ` +
      `${carried.versions} testcase version(s), ${carried.screenshots} screenshot(s)`)

    if (DRY_RUN) {
      console.log('\n(dry run — nothing written)')
      return
    }

    // ── the writes, all or nothing ────────────────────────────────────────────
    await runner.startTransaction()
    try {
      const p = [TO, FROM, ...FEATURES]          // @0 = TO, @1 = FROM, @2.. = features
      const fIn = inList(2, F)
      await q(`UPDATE features SET appSlug = @0 WHERE appSlug = @1 AND name IN (${fIn})`, p)
      await q(`UPDATE bugs SET appSlug = @0 WHERE appSlug = @1 AND feature IN (${fIn})`, p)
      await q(`UPDATE intake_documents SET appSlug = @0
                 WHERE appSlug = @1 AND scopeKind = 'feature' AND scopeSlug IN (${fIn})`, p)

      if (MODULE) {
        await q('UPDATE modules SET appSlug = @0 WHERE appSlug = @1 AND slug = @2', [TO, FROM, MODULE])
        await q('UPDATE knowledge_files SET appSlug = @0 WHERE appSlug = @1 AND module = @2', [TO, FROM, MODULE])
        await q('UPDATE requirements SET appSlug = @0 WHERE appSlug = @1 AND module = @2', [TO, FROM, MODULE])
      }

      if (COPY_MEMBERSHIPS) {
        // COPY, never move: the source app keeps its own members. Without a row here a
        // non-admin gets a 404 and the app is invisible to them — admins bypass the check,
        // which is exactly how this ships broken and nobody notices.
        await q(
          `INSERT INTO app_memberships (userId, appSlug, role, permissions)
           SELECT m.userId, @0, m.role, m.permissions
             FROM app_memberships m
            WHERE m.appSlug = @1
              AND NOT EXISTS (SELECT 1 FROM app_memberships x
                               WHERE x.userId = m.userId AND x.appSlug = @0)`,
          [TO, FROM],
        )
        const n = await count('SELECT COUNT(*) AS n FROM app_memberships WHERE appSlug = @0', [TO])
        console.log(`  memberships on "${TO}" after copy: ${n}`)
      }

      await runner.commitTransaction()
      console.log('\ncommitted')
    } catch (err) {
      await runner.rollbackTransaction()
      console.error('\nrolled back — nothing was changed')
      throw err
    }
  } finally {
    await runner.release()
    await AppDataSource.destroy()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
