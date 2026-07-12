import fs from 'fs'
import path from 'path'
import { EXECUTION_STATUSES, type ExecutionStatus } from './execution-types'
import { getDataRoot } from './paths'

export { EXECUTION_STATUSES, DEFAULT_EXECUTION_STATUS } from './execution-types'
export type { ExecutionStatus } from './execution-types'

function isValidStatus(s: string): s is ExecutionStatus {
  return (EXECUTION_STATUSES as readonly string[]).includes(s)
}

// ─── Version-scoped storage ─────────────────────────────────────────────────
// Execution status/bug-links are scoped per test-case-version so history for
// an old version (e.g. v1) survives a full regenerate to a new version (e.g.
// v2), instead of sharing one flat, feature-wide namespace. Passing no
// `version` reads/writes the legacy flat file (`execution-status.json` with no
// suffix) — this is the fallback for any feature that predates version
// scoping, so nothing already in the wild breaks. Once a version-specific file
// exists for a feature, it is used exclusively for that version going forward.

function executionFilePath(appSlug: string, featureName: string, version?: string): string {
  const filename = version ? `execution-status-v${version}.json` : 'execution-status.json'
  return path.join(getDataRoot(), appSlug, 'features', featureName, filename)
}

// Writers must never default to the legacy flat file while readers resolve
// "latest" to a concrete version (the GET route does exactly that) — the
// status would be written where no read ever looks. When a caller omits
// `version` (execution-tab PUT before the user touches the version selector,
// automation regression runs), resolve it to the latest testcase version on
// disk, mirroring how the read side resolves "latest". Returns undefined only
// for features with no versioned testcase files, which genuinely live on the
// legacy flat file.
function resolveWriteVersion(appSlug: string, featureName: string, version?: string): string | undefined {
  if (version) return version
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

export async function getExecutions(
  appSlug: string,
  featureName: string,
  version?: string,
): Promise<Record<string, ExecutionStatus>> {
  return readFromFs(appSlug, featureName, version)
}

// ─── execution-status.json write mutex ──────────────────────────────────────
// setExecutionStatus is a read-modify-write against a per feature/version JSON
// file. Two calls landing close together (e.g. a manual click racing an
// automation regression writing results for the same feature) can otherwise
// interleave across the awaited fs calls: the second reader misses the
// first writer's not-yet-flushed change and clobbers it. Keyed per file so
// unrelated features/versions never block each other; a promise chain is
// enough since this runs in a single Node process. Local to this file per
// the reliability-fix scope — automation-hub/store.ts has its own copy.
const executionStatusLocks = new Map<string, Promise<unknown>>()

function withExecutionLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = executionStatusLocks.get(key) ?? Promise.resolve()
  const run = prev.then(fn, fn)
  executionStatusLocks.set(key, run.then(() => undefined, () => undefined))
  return run
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
      const effectiveVersion = resolveWriteVersion(appSlug, featureName, version)
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
// it (one bug per case, latest wins). Kept apart from execution-status.json so
// the status read/validation path is untouched. Version-scoped the same way.

function executionBugsFilePath(appSlug: string, featureName: string, version?: string): string {
  const filename = version ? `execution-bugs-v${version}.json` : 'execution-bugs.json'
  return path.join(getDataRoot(), appSlug, 'features', featureName, filename)
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
  return readBugsFromFs(appSlug, featureName, version)
}

/**
 * Clears execution status + testcase→bug links for a feature. Called when a
 * fresh test-case version fully replaces the previous set (full regenerate),
 * so stale Pass/Fail results and bug links don't carry over onto different
 * cases. Scoped to `version` when given — a brand-new version's own files
 * start clean without touching any other version's history. With no
 * `version`, clears the legacy flat files (only relevant for features that
 * still write there because they've never had a version-scoped file).
 * Additive changes (add-more, quick-add) do NOT call this — their existing
 * case IDs keep their status and only the appended cases start as "New Added".
 */
export async function clearExecutions(appSlug: string, featureName: string, version?: string): Promise<void> {
  for (const file of [
    executionFilePath(appSlug, featureName, version),
    executionBugsFilePath(appSlug, featureName, version),
  ]) {
    try {
      if (fs.existsSync(file)) fs.unlinkSync(file)
    } catch {
      // non-fatal
    }
  }
}

/** Removes execution status + bug-link entries for specific testcase IDs.
 *  Used by "Undo last add" so stripped cases don't leave orphaned statuses behind. */
export async function removeExecutionEntries(
  appSlug: string,
  featureName: string,
  testcaseIds: string[],
  version?: string,
): Promise<void> {
  const ids = new Set(testcaseIds)
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
    const effectiveVersion = resolveWriteVersion(appSlug, featureName, version)
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
