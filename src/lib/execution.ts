import fs from 'fs'
import path from 'path'
import { EXECUTION_STATUSES, type ExecutionStatus } from './execution-types'
import { getDataRoot } from './paths'
import { getDataSource } from './db'
import { FeatureEntity, TestExecutionEntity, TestcaseVersionEntity, type ITestExecution } from './entities'

export { EXECUTION_STATUSES, DEFAULT_EXECUTION_STATUS } from './execution-types'
export type { ExecutionStatus } from './execution-types'

type DS = Awaited<ReturnType<typeof getDataSource>>

function isValidStatus(s: string): s is ExecutionStatus {
  return (EXECUTION_STATUSES as readonly string[]).includes(s)
}

// ─── Version-scoped storage ─────────────────────────────────────────────────
// Execution status/bug-links are scoped per test-case-version so history for
// an old version (e.g. v1) survives a full regenerate to a new version (e.g.
// v2), instead of sharing one flat, feature-wide namespace. Passing no
// `version` reads/writes the legacy flat namespace (`version IS NULL` in the
// DB, `execution-status.json` with no suffix on disk) — this is the fallback
// for any feature that predates version scoping, so nothing already in the
// wild breaks. Once a version-specific row/file exists for a feature, it is
// used exclusively for that version going forward.
//
// Phase 3c: test_executions (DB) is now the primary store for status +
// bugSlug, keyed on the (featureId, version, testcaseId) unique index. The
// JSON files under data/<app>/features/<feature>/ are still written on every
// mutation (write-through, kept for export parity until phase 5) and are the
// fallback whenever the DB is unreachable OR a feature has never had any
// rows written to test_executions at all (not yet migrated).

function executionFilePath(appSlug: string, featureName: string, version?: string): string {
  const filename = version ? `execution-status-v${version}.json` : 'execution-status.json'
  return path.join(getDataRoot(), appSlug, 'features', featureName, filename)
}

// Writers must never default to the legacy flat namespace while readers
// resolve "latest" to a concrete version (the GET route does exactly that) —
// the status would be written where no read ever looks. When a caller omits
// `version` (execution-tab PUT before the user touches the version selector,
// automation regression runs), resolve it to the latest testcase version,
// mirroring how the read side resolves "latest". Returns undefined only for
// features with no versioned testcases at all, which genuinely live on the
// legacy flat namespace.
//
// DB-first: MAX(version) from testcase_versions for the feature. Falls back
// to the on-disk `-testcases-vN.md` glob on DB error (or when the feature
// isn't in the DB yet) — a legitimate "no versions exist" result (MAX is
// NULL) is not an error and correctly resolves to undefined, same as an
// empty glob.
function resolveWriteVersionFromFs(appSlug: string, featureName: string): string | undefined {
  const featureDir = path.join(getDataRoot(), appSlug, 'features', featureName)
  if (!fs.existsSync(featureDir)) return undefined
  const versionRe = new RegExp(`^${featureName}-testcases-v(\\d+)\\.md$`)
  let latest: number | undefined
  for (const f of fs.readdirSync(featureDir)) {
    const m = f.match(versionRe)
    if (m) {
      const n = parseInt(m[1], 10)
      if (latest === undefined || n > latest) latest = n
    }
  }
  return latest === undefined ? undefined : String(latest)
}

async function resolveWriteVersion(appSlug: string, featureName: string, version?: string): Promise<string | undefined> {
  if (version) return version
  try {
    const ds = await getDataSource()
    const feature = await ds.getRepository(FeatureEntity).findOne({ where: { appSlug, name: featureName } })
    if (!feature) return resolveWriteVersionFromFs(appSlug, featureName)

    const result = await ds
      .getRepository(TestcaseVersionEntity)
      .createQueryBuilder('tv')
      .select('MAX(tv.version)', 'max')
      .where('tv.featureId = :fId', { fId: feature.id })
      .getRawOne<{ max: number | null }>()

    const max = result?.max
    return max === null || max === undefined ? undefined : String(max)
  } catch {
    return resolveWriteVersionFromFs(appSlug, featureName)
  }
}

function readFromFs(appSlug: string, featureName: string, version?: string): Record<string, ExecutionStatus> {
  let file = executionFilePath(appSlug, featureName, version)
  // A version was requested but has no file of its own yet — this feature
  // hasn't been migrated to version-scoped execution, so fall back to the
  // legacy flat file rather than showing empty for every version.
  if (version && !fs.existsSync(file)) file = executionFilePath(appSlug, featureName)
  if (!fs.existsSync(file)) return {}
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, string>
    const map: Record<string, ExecutionStatus> = {}
    for (const [id, status] of Object.entries(raw)) {
      if (isValidStatus(status)) map[id] = status
    }
    return map
  } catch {
    return {}
  }
}

function writeToFs(appSlug: string, featureName: string, map: Record<string, ExecutionStatus>, version?: string): void {
  const file = executionFilePath(appSlug, featureName, version)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(map, null, 2), 'utf-8')
}

/**
 * Fetches test_executions rows for (featureId, version). When a concrete
 * version is requested but has no rows of its own, falls back to the legacy
 * flat rows (`version IS NULL`) — mirroring readFromFs's per-version file
 * fallback, so a version that has never had a status/bug written shows the
 * legacy history instead of appearing empty.
 */
async function fetchExecutionRows(ds: DS, featureId: number, version?: string): Promise<ITestExecution[]> {
  const repo = ds.getRepository(TestExecutionEntity)
  const versionNum = version !== undefined ? parseInt(version, 10) : null
  const byVersion = (v: number | null) => {
    const qb = repo.createQueryBuilder('te').where('te.featureId = :fId', { fId: featureId })
    if (v === null) qb.andWhere('te.version IS NULL')
    else qb.andWhere('te.version = :v', { v })
    return qb.getMany()
  }
  let rows = await byVersion(versionNum)
  if (versionNum !== null && rows.length === 0) rows = await byVersion(null)
  return rows
}

export async function getExecutions(
  appSlug: string,
  featureName: string,
  version?: string,
): Promise<Record<string, ExecutionStatus>> {
  try {
    const ds = await getDataSource()
    const feature = await ds.getRepository(FeatureEntity).findOne({ where: { appSlug, name: featureName } })
    if (!feature) return readFromFs(appSlug, featureName, version)

    const totalCount = await ds
      .getRepository(TestExecutionEntity)
      .createQueryBuilder('te')
      .where('te.featureId = :fId', { fId: feature.id })
      .getCount()
    // Feature has never had a row written to test_executions (not migrated /
    // never touched since) — read JSON files as before rather than showing empty.
    if (totalCount === 0) return readFromFs(appSlug, featureName, version)

    const rows = await fetchExecutionRows(ds, feature.id, version)
    const map: Record<string, ExecutionStatus> = {}
    for (const row of rows) {
      if (isValidStatus(row.status)) map[row.testcaseId] = row.status
    }
    return map
  } catch {
    return readFromFs(appSlug, featureName, version)
  }
}

// ─── write mutex ─────────────────────────────────────────────────────────────
// setExecutionStatus is a read-modify-write against a per feature/version JSON
// file (kept this phase for write-through parity) alongside a DB upsert. Two
// calls landing close together (e.g. a manual click racing an automation
// regression writing results for the same feature) can otherwise interleave
// across the awaited fs calls: the second reader misses the first writer's
// not-yet-flushed change and clobbers it. The DB side is protected by the
// (featureId, version, testcaseId) unique index, but the JSON write-through
// still needs serializing, so the lock is kept wrapping both the DB upsert and
// the file write (minimal-risk: one lock, not two). Keyed per file so
// unrelated features/versions never block each other; a promise chain is
// enough since this runs in a single Node process. Local to this file per the
// reliability-fix scope — automation-hub/store.ts has its own copy.
const executionStatusLocks = new Map<string, Promise<unknown>>()

function withExecutionLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = executionStatusLocks.get(key) ?? Promise.resolve()
  const run = prev.then(fn, fn)
  executionStatusLocks.set(key, run.then(() => undefined, () => undefined))
  return run
}

/**
 * Upserts a single test_executions row on the (featureId, version,
 * testcaseId) unique index: looks up the row by its concrete key, then
 * updates just that row by primary key, or inserts a new one. New rows
 * created purely to hold a bug link (no status set yet) default to
 * 'new_added' — mirroring the JSON semantics where linking a bug never
 * implies/overwrites a status.
 */
async function upsertExecutionRow(
  appSlug: string,
  featureName: string,
  testcaseId: string,
  version: string | undefined,
  patch: { status?: string; bugSlug?: string; notes?: string | null },
): Promise<void> {
  const ds = await getDataSource()
  const feature = await ds.getRepository(FeatureEntity).findOne({ where: { appSlug, name: featureName } })
  if (!feature) return // feature not migrated to DB yet — file write-through covers it

  const versionNum = version !== undefined ? parseInt(version, 10) : null
  const repo = ds.getRepository(TestExecutionEntity)
  const qb = repo
    .createQueryBuilder('te')
    .where('te.featureId = :fId AND te.testcaseId = :testcaseId', { fId: feature.id, testcaseId })
  if (versionNum === null) qb.andWhere('te.version IS NULL')
  else qb.andWhere('te.version = :v', { v: versionNum })
  const existing = await qb.getOne()

  if (existing) {
    await repo.update(existing.id, patch)
  } else {
    await repo.insert({
      feature: { id: feature.id },
      version: versionNum,
      testcaseId,
      status: patch.status ?? 'new_added',
      bugSlug: patch.bugSlug ?? null,
      notes: patch.notes ?? null,
    })
  }
}

export async function setExecutionStatus(
  appSlug: string,
  featureName: string,
  testcaseId: string,
  status: string,
  version?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!isValidStatus(status)) return { ok: false, error: `Invalid status: "${status}"` }
  const lockKey = `${appSlug}::${featureName}::${version ?? ''}`
  return withExecutionLock(lockKey, async () => {
    try {
      const effectiveVersion = await resolveWriteVersion(appSlug, featureName, version)

      try {
        await upsertExecutionRow(appSlug, featureName, testcaseId, effectiveVersion, { status })
      } catch {
        // DB unavailable — file write-through below still records the change
      }

      const map = readFromFs(appSlug, featureName, effectiveVersion)
      map[testcaseId] = status
      writeToFs(appSlug, featureName, map, effectiveVersion)
      return { ok: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { ok: false, error: message }
    }
  })
}

// ─── Test case → bug links ──────────────────────────────────────────────────
// A separate sibling file maps a testcase ID to the slug of the bug raised for
// it (one bug per case, latest wins). In the DB this shares the same
// test_executions row (bugSlug column) as the status. Kept apart on disk so
// the status read/validation path is untouched. Version-scoped the same way.

function executionBugsFilePath(appSlug: string, featureName: string, version?: string): string {
  const filename = version ? `execution-bugs-v${version}.json` : 'execution-bugs.json'
  return path.join(getDataRoot(), appSlug, 'features', featureName, filename)
}

// ─── Test case → notes ──────────────────────────────────────────────────────
// A third sibling file, alongside status and the bug link, mapping a testcase
// ID to a free-text note recorded at execution time (e.g. "Executed live
// 2026-07-29…", "DEFECT (P1): …") — observations that don't belong on the
// spec row itself. Shares the same test_executions row (notes column) in the
// DB. Version-scoped the same way as status/bugSlug.

function executionNotesFilePath(appSlug: string, featureName: string, version?: string): string {
  const filename = version ? `execution-notes-v${version}.json` : 'execution-notes.json'
  return path.join(getDataRoot(), appSlug, 'features', featureName, filename)
}

function readNotesFromFs(appSlug: string, featureName: string, version?: string): Record<string, string> {
  let file = executionNotesFilePath(appSlug, featureName, version)
  if (version && !fs.existsSync(file)) file = executionNotesFilePath(appSlug, featureName)
  if (!fs.existsSync(file)) return {}
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>
    const map: Record<string, string> = {}
    for (const [id, note] of Object.entries(raw)) {
      if (typeof note === 'string' && note) map[id] = note
    }
    return map
  } catch {
    return {}
  }
}

function readBugsFromFs(appSlug: string, featureName: string, version?: string): Record<string, string> {
  let file = executionBugsFilePath(appSlug, featureName, version)
  if (version && !fs.existsSync(file)) file = executionBugsFilePath(appSlug, featureName)
  if (!fs.existsSync(file)) return {}
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>
    const map: Record<string, string> = {}
    for (const [id, slug] of Object.entries(raw)) {
      if (typeof slug === 'string' && slug) map[id] = slug
    }
    return map
  } catch {
    return {}
  }
}

export async function getExecutionBugs(
  appSlug: string,
  featureName: string,
  version?: string,
): Promise<Record<string, string>> {
  try {
    const ds = await getDataSource()
    const feature = await ds.getRepository(FeatureEntity).findOne({ where: { appSlug, name: featureName } })
    if (!feature) return readBugsFromFs(appSlug, featureName, version)

    const totalCount = await ds
      .getRepository(TestExecutionEntity)
      .createQueryBuilder('te')
      .where('te.featureId = :fId', { fId: feature.id })
      .getCount()
    if (totalCount === 0) return readBugsFromFs(appSlug, featureName, version)

    const rows = await fetchExecutionRows(ds, feature.id, version)
    const map: Record<string, string> = {}
    for (const row of rows) {
      if (row.bugSlug) map[row.testcaseId] = row.bugSlug
    }
    return map
  } catch {
    return readBugsFromFs(appSlug, featureName, version)
  }
}

export async function getExecutionNotes(
  appSlug: string,
  featureName: string,
  version?: string,
): Promise<Record<string, string>> {
  try {
    const ds = await getDataSource()
    const feature = await ds.getRepository(FeatureEntity).findOne({ where: { appSlug, name: featureName } })
    if (!feature) return readNotesFromFs(appSlug, featureName, version)

    const totalCount = await ds
      .getRepository(TestExecutionEntity)
      .createQueryBuilder('te')
      .where('te.featureId = :fId', { fId: feature.id })
      .getCount()
    if (totalCount === 0) return readNotesFromFs(appSlug, featureName, version)

    const rows = await fetchExecutionRows(ds, feature.id, version)
    const map: Record<string, string> = {}
    for (const row of rows) {
      if (row.notes) map[row.testcaseId] = row.notes
    }
    return map
  } catch {
    return readNotesFromFs(appSlug, featureName, version)
  }
}

/**
 * Clears execution status + testcase→bug links for a feature. Called when a
 * fresh test-case version fully replaces the previous set (full regenerate),
 * so stale Pass/Fail results and bug links don't carry over onto different
 * cases. Scoped to `version` when given — a brand-new version's own rows/files
 * start clean without touching any other version's history. With no
 * `version`, clears the legacy flat rows/files (only relevant for features
 * that still write there because they've never had a version-scoped one).
 * Additive changes (add-more, quick-add) do NOT call this — their existing
 * case IDs keep their status and only the appended cases start as "New Added".
 */
export async function clearExecutions(appSlug: string, featureName: string, version?: string): Promise<void> {
  try {
    const ds = await getDataSource()
    const feature = await ds.getRepository(FeatureEntity).findOne({ where: { appSlug, name: featureName } })
    if (feature) {
      const versionNum = version !== undefined ? parseInt(version, 10) : null
      if (versionNum === null) {
        await ds.query('DELETE FROM test_executions WHERE featureId = @0 AND version IS NULL', [feature.id])
      } else {
        await ds.query('DELETE FROM test_executions WHERE featureId = @0 AND version = @1', [feature.id, versionNum])
      }
    }
  } catch {
    // DB unavailable — file deletion below is sufficient
  }

  for (const file of [
    executionFilePath(appSlug, featureName, version),
    executionBugsFilePath(appSlug, featureName, version),
    executionNotesFilePath(appSlug, featureName, version),
  ]) {
    try {
      if (fs.existsSync(file)) fs.unlinkSync(file)
    } catch {
      // non-fatal
    }
  }
}

/** Removes execution status + bug-link + note entries for specific testcase IDs.
 *  Used by "Undo last add" so stripped cases don't leave orphaned statuses/notes behind. */
export async function removeExecutionEntries(
  appSlug: string,
  featureName: string,
  testcaseIds: string[],
  version?: string,
): Promise<void> {
  const ids = new Set(testcaseIds)

  if (testcaseIds.length > 0) {
    try {
      const ds = await getDataSource()
      const feature = await ds.getRepository(FeatureEntity).findOne({ where: { appSlug, name: featureName } })
      if (feature) {
        const versionNum = version !== undefined ? parseInt(version, 10) : null
        const params: Array<number | string> = [feature.id]
        let versionClause: string
        if (versionNum === null) {
          versionClause = 'version IS NULL'
        } else {
          params.push(versionNum)
          versionClause = `version = @${params.length - 1}`
        }
        const idsStart = params.length
        params.push(...testcaseIds)
        const placeholders = testcaseIds.map((_, i) => `@${idsStart + i}`).join(', ')
        await ds.query(
          `DELETE FROM test_executions WHERE featureId = @0 AND ${versionClause} AND testcaseId IN (${placeholders})`,
          params,
        )
      }
    } catch {
      // DB unavailable — file writes below are sufficient
    }
  }

  try {
    const statuses = readFromFs(appSlug, featureName, version)
    const keptStatuses = Object.fromEntries(Object.entries(statuses).filter(([id]) => !ids.has(id)))
    writeToFs(appSlug, featureName, keptStatuses, version)
  } catch {
    // non-fatal
  }
  try {
    const bugs = readBugsFromFs(appSlug, featureName, version)
    const keptBugs = Object.fromEntries(Object.entries(bugs).filter(([id]) => !ids.has(id)))
    const file = executionBugsFilePath(appSlug, featureName, version)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(keptBugs, null, 2), 'utf-8')
  } catch {
    // non-fatal
  }
  try {
    const notes = readNotesFromFs(appSlug, featureName, version)
    const keptNotes = Object.fromEntries(Object.entries(notes).filter(([id]) => !ids.has(id)))
    const file = executionNotesFilePath(appSlug, featureName, version)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(keptNotes, null, 2), 'utf-8')
  } catch {
    // non-fatal
  }
}

export async function setExecutionBug(
  appSlug: string,
  featureName: string,
  testcaseId: string,
  bugSlug: string,
  version?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!testcaseId || !bugSlug) return { ok: false, error: 'testcaseId and bugSlug required' }
  try {
    const effectiveVersion = await resolveWriteVersion(appSlug, featureName, version)

    try {
      await upsertExecutionRow(appSlug, featureName, testcaseId, effectiveVersion, { bugSlug })
    } catch {
      // DB unavailable — file write-through below still records the link
    }

    const map = readBugsFromFs(appSlug, featureName, effectiveVersion)
    map[testcaseId] = bugSlug
    const file = executionBugsFilePath(appSlug, featureName, effectiveVersion)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(map, null, 2), 'utf-8')
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: message }
  }
}

/**
 * Sets (or clears) the free-text note for a single test case. An
 * empty/whitespace-only `note` CLEARS the value rather than storing an empty
 * string: the DB column is set to null and the key is dropped from the JSON
 * map, so a note that's been typed-then-erased doesn't linger as `""`
 * everywhere a note is checked for presence. Shares setExecutionStatus's lock
 * (keyed the same way, per feature/version) so a concurrent status write and
 * note write against the same file can't interleave.
 */
/**
 * Append a single line to a test case's note, keeping whatever is already there
 * and replacing only a previous line that starts with `replacePrefix`.
 *
 * Exists so an automated writer (the automation → execution sync) can record a
 * run outcome without destroying the tester's own observation — the whole point
 * of the notes field. Resolving the version and re-reading the current note MUST
 * happen inside the same lock as the write, which is why this lives here rather
 * than being assembled by the caller: a caller doing read-then-write would both
 * race a concurrent edit and, worse, read the legacy flat namespace while the
 * write resolved to the latest version.
 */
export async function appendExecutionNoteLine(
  appSlug: string,
  featureName: string,
  testcaseId: string,
  line: string,
  opts?: { replacePrefix?: string },
  version?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!testcaseId) return { ok: false, error: 'testcaseId required' }
  const lockKey = `${appSlug}::${featureName}::${version ?? ''}`
  return withExecutionLock(lockKey, async () => {
    try {
      const effectiveVersion = await resolveWriteVersion(appSlug, featureName, version)
      const map = readNotesFromFs(appSlug, featureName, effectiveVersion)
      const kept = (map[testcaseId] ?? '')
        .split('\n')
        .filter((l) => l.trim() && !(opts?.replacePrefix && l.trimStart().startsWith(opts.replacePrefix)))
      const merged = [...kept, line].join('\n')

      try {
        await upsertExecutionRow(appSlug, featureName, testcaseId, effectiveVersion, { notes: merged })
      } catch {
        // DB unavailable — file write-through below still records the change
      }

      map[testcaseId] = merged
      const file = executionNotesFilePath(appSlug, featureName, effectiveVersion)
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, JSON.stringify(map, null, 2), 'utf-8')
      return { ok: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { ok: false, error: message }
    }
  })
}

export async function setExecutionNote(
  appSlug: string,
  featureName: string,
  testcaseId: string,
  note: string,
  version?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!testcaseId) return { ok: false, error: 'testcaseId required' }
  const trimmed = note.trim()
  const lockKey = `${appSlug}::${featureName}::${version ?? ''}`
  return withExecutionLock(lockKey, async () => {
    try {
      const effectiveVersion = await resolveWriteVersion(appSlug, featureName, version)

      try {
        await upsertExecutionRow(appSlug, featureName, testcaseId, effectiveVersion, {
          notes: trimmed ? trimmed : null,
        })
      } catch {
        // DB unavailable — file write-through below still records the change
      }

      const map = readNotesFromFs(appSlug, featureName, effectiveVersion)
      if (trimmed) {
        map[testcaseId] = trimmed
      } else {
        delete map[testcaseId]
      }
      const file = executionNotesFilePath(appSlug, featureName, effectiveVersion)
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, JSON.stringify(map, null, 2), 'utf-8')
      return { ok: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { ok: false, error: message }
    }
  })
}
