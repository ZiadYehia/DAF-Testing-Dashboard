/**
 * Automation Hub — filesystem storage.
 *
 * Layout (all under automation-hub/projects/):
 *   <name>/
 *     test.spec.ts          editable + replayable Playwright spec
 *     meta.json             ProjectMeta
 *     runs/
 *       <ts>/               one folder per run (history, newest kept)
 *         video.webm
 *         trace.zip
 *         result.json
 */
import fs from 'fs/promises'
import path from 'path'
import {
  MAX_RUN_HISTORY,
  type ProjectMeta, type ProjectDetail, type CreatedVia, type LinkedTestcase,
  type AutomationEngine, type AppiumTarget, type RunRecord,
  type TsArtifacts,
} from './types'

// Resolve from cwd (not __dirname) so the path survives Next's server bundling —
// the same pattern the dashboard uses for its `data/` root.
export const HUB_ROOT = process.env.AUTOMATION_HUB_ROOT ?? path.join(process.cwd(), 'automation-hub')
export const PROJECTS_DIR = path.join(HUB_ROOT, 'projects')
// Vendored pytest framework root — pages/<app>/*.py (shared page objects) and
// tests/<app>/test_<slug>.py (fluent tests generated/edited by this hub).
export const PYTHON_ROOT = path.join(HUB_ROOT, 'python')

export function projectDir(name: string): string {
  return path.join(PROJECTS_DIR, name)
}
/**
 * Filename for a project's primary spec, by engine.
 *
 * `api` deliberately keeps `test.spec.ts`: an API project is still a @playwright/test file
 * (it just uses APIRequestContext instead of a page), and hundreds of existing API projects
 * already carry that name. It is distinguished from a browser project by the config project
 * it runs under — see playwrightProjectFor — not by its filename.
 */
export function specFileName(engine?: AutomationEngine): string {
  return engine === 'appium' ? 'test.appium.mjs' : 'test.spec.ts'
}
export function specPath(name: string, engine?: AutomationEngine): string {
  return path.join(projectDir(name), specFileName(engine))
}
// Legacy Python spec location, from before tests moved out of project folders.
// Still read as a fallback (see getProject) — never written by new code.
export const PY_SPEC_FILE = 'test_spec.py'
export function pySpecPath(name: string): string {
  return path.join(projectDir(name), PY_SPEC_FILE)
}

/** Posix-relative (to automation-hub/) path for a project's Python test file. */
export function pyTestRelPath(app: string, name: string): string {
  return `python/tests/${app}/test_${name.replace(/-/g, '_')}.py`
}
export function metaPath(name: string): string {
  return path.join(projectDir(name), 'meta.json')
}
export function runsDir(name: string): string {
  return path.join(projectDir(name), 'runs')
}
export function runDir(name: string, ts: string): string {
  return path.join(runsDir(name), ts)
}

/**
 * Key NAMES (never values) declared in automation-hub/.env — injected into codegen
 * prompts so generated specs reference process.env.<KEY> instead of hardcoding
 * secrets/URLs. Next-side counterpart of lib/env.ts (which is Playwright-child-only:
 * it resolves via __dirname, which the Next bundler rewrites).
 */
export async function listHubEnvKeys(): Promise<string[]> {
  try {
    const raw = await fs.readFile(path.join(HUB_ROOT, '.env'), 'utf8')
    return raw
      .split(/\r?\n/)
      .map((l) => /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(l)?.[1])
      .filter((k): k is string => !!k)
  } catch {
    return []
  }
}

/** Slugify a user-supplied title into a filesystem-safe folder name. */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'untitled'
}

async function exists(p: string): Promise<boolean> {
  try { await fs.access(p); return true } catch { return false }
}

/** List all project names (folders that contain a meta.json). */
export async function listProjectNames(): Promise<string[]> {
  if (!(await exists(PROJECTS_DIR))) return []
  const entries = await fs.readdir(PROJECTS_DIR, { withFileTypes: true })
  const names: string[] = []
  for (const e of entries) {
    if (e.isDirectory() && (await exists(metaPath(e.name)))) names.push(e.name)
  }
  return names.sort()
}

export async function readMeta(name: string): Promise<ProjectMeta | null> {
  try {
    const raw = await fs.readFile(metaPath(name), 'utf8')
    const meta = JSON.parse(raw) as ProjectMeta
    // Bulk-imported meta.json files may omit run state — normalize so the UI
    // (and recordRun's `[record, ...meta.runs]`) never see undefined.
    meta.runs ??= []
    meta.lastStatus ??= 'never_run'
    return meta
  } catch {
    return null
  }
}

export async function writeMeta(meta: ProjectMeta): Promise<void> {
  await fs.mkdir(projectDir(meta.name), { recursive: true })
  await fs.writeFile(metaPath(meta.name), JSON.stringify(meta, null, 2), 'utf8')
}

// ─── meta.json write mutex ──────────────────────────────────────────────────
// meta.json is read-modify-written from multiple call sites: setTags,
// setLinkedTestcase, and recordRun below (called by both engine/runner.ts and
// engine/appium-runner.ts). Without serialization two concurrent updates
// (e.g. a run finishing while the user retags the project) can race — the
// second writer's read misses the first
// writer's not-yet-flushed change and clobbers it on write. Keyed per project
// name so unrelated projects never block each other; a promise chain is
// enough since this runs in a single Node process.
const metaLocks = new Map<string, Promise<unknown>>()

/** Run `fn` exclusively per project `name`, queued behind any in-flight meta.json write. */
export function withMetaLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const prev = metaLocks.get(name) ?? Promise.resolve()
  const run = prev.then(fn, fn)
  // Store a non-rejecting tail so one failed write doesn't wedge the chain for
  // the next caller (that caller's own `run` promise still rejects normally).
  metaLocks.set(name, run.then(() => undefined, () => undefined))
  return run
}

/**
 * Prepend a run to meta, set lastStatus, and prune old run folders beyond the cap.
 * Shares meta.json's write mutex (withMetaLock) with setTags/setLinkedTestcase —
 * both rewrite the same file, so an update here can't race with a concurrent
 * tag/link edit. Engine-agnostic (works off RunRecord/ProjectMeta alone), so both
 * the Playwright runner (engine/runner.ts) and the Appium runner call this.
 */
export async function recordRun(name: string, record: RunRecord): Promise<void> {
  const runs = await withMetaLock(name, async () => {
    const meta = await readMeta(name)
    if (!meta) return null
    const updatedRuns = [record, ...meta.runs].slice(0, MAX_RUN_HISTORY)
    const updated: ProjectMeta = { ...meta, lastStatus: record.status, runs: updatedRuns }
    await writeMeta(updated)
    return updatedRuns
  })
  if (!runs) return

  // Delete run folders no longer referenced in meta.
  const keep = new Set(runs.map((r) => r.ts))
  try {
    const entries = await fs.readdir(runsDir(name), { withFileTypes: true })
    for (const e of entries) {
      if (e.isDirectory() && !keep.has(e.name)) {
        await fs.rm(path.join(runsDir(name), e.name), { recursive: true, force: true })
      }
    }
  } catch { /* runs dir may not exist on first run race — ignore */ }
}

export async function listProjects(): Promise<ProjectMeta[]> {
  const names = await listProjectNames()
  const metas = await Promise.all(names.map(readMeta))
  return metas.filter((m): m is ProjectMeta => m !== null)
}

export async function getProject(name: string): Promise<ProjectDetail | null> {
  const meta = await readMeta(name)
  if (!meta) return null
  let spec = ''
  try { spec = await fs.readFile(specPath(name, meta.engine), 'utf8') } catch { /* spec may not exist yet */ }
  let pySpec: string | null = null
  try {
    pySpec = meta.pyTestPath
      ? await fs.readFile(path.join(HUB_ROOT, meta.pyTestPath), 'utf8')
      // Legacy fallback: projects created before tests moved to python/tests/<app>/.
      : await fs.readFile(pySpecPath(name), 'utf8')
  } catch { /* python spec may not exist */ }
  return { ...meta, spec, pySpec }
}

export interface CreateProjectInput {
  title: string
  spec: string
  /** Dashboard app slug the automation belongs to. */
  app?: string
  createdVia?: CreatedVia
  linkedTestcaseId?: string | null
  linkedTestcase?: LinkedTestcase | null
  tags?: string[]
  /** ISO timestamp; callers pass it in since Date is unavailable in some contexts. */
  now: string
  /** Which engine drives this project. Absent = 'playwright'. */
  engine?: AutomationEngine
  /** Appium target config. Present only when engine === 'appium'. */
  appium?: AppiumTarget
}

/** Create a new project folder with an initial spec. Fails if the name is taken. */
export async function createProject(input: CreateProjectInput): Promise<ProjectMeta> {
  const name = slugify(input.title)
  if (await exists(projectDir(name))) {
    throw new Error(`A project named "${name}" already exists`)
  }
  const meta: ProjectMeta = {
    name,
    title: input.title,
    app: input.app,
    createdVia: input.createdVia ?? 'manual',
    linkedTestcaseId: input.linkedTestcaseId ?? input.linkedTestcase?.testcaseId ?? null,
    linkedTestcase: input.linkedTestcase ?? null,
    createdAt: input.now,
    lastStatus: 'never_run',
    runs: [],
    tags: input.tags ?? [],
    engine: input.engine,
    appium: input.appium,
  }
  await fs.mkdir(projectDir(name), { recursive: true })
  await fs.writeFile(specPath(name, input.engine), input.spec, 'utf8')
  await writeMeta(meta)
  return meta
}

/** Replace a project's tags. */
export async function setTags(name: string, tags: string[]): Promise<ProjectMeta> {
  return withMetaLock(name, async () => {
    const meta = await readMeta(name)
    if (!meta) throw new Error(`Unknown project "${name}"`)
    const cleaned = [...new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))]
    const updated: ProjectMeta = { ...meta, tags: cleaned }
    await writeMeta(updated)
    return updated
  })
}

/** Move a project into a suite folder (null = unfiled). */
export async function setFolder(name: string, folder: string | null): Promise<ProjectMeta> {
  return withMetaLock(name, async () => {
    const meta = await readMeta(name)
    if (!meta) throw new Error(`Unknown project "${name}"`)
    const cleaned = folder?.trim() || null
    const updated: ProjectMeta = { ...meta, folder: cleaned }
    await writeMeta(updated)
    return updated
  })
}

/** Link (or unlink with null) a dashboard test case; replays then sync its status. */
export async function setLinkedTestcase(
  name: string,
  link: LinkedTestcase | null,
): Promise<ProjectMeta> {
  return withMetaLock(name, async () => {
    const meta = await readMeta(name)
    if (!meta) throw new Error(`Unknown project "${name}"`)
    const updated: ProjectMeta = {
      ...meta,
      linkedTestcase: link,
      linkedTestcaseId: link?.testcaseId ?? null,
    }
    await writeMeta(updated)
    return updated
  })
}

/** Overwrite a project's spec source (used by the in-app editor). */
export async function saveSpec(name: string, spec: string): Promise<void> {
  const meta = await readMeta(name)
  if (!meta) throw new Error(`Unknown project "${name}"`)
  await fs.writeFile(specPath(name, meta.engine), spec, 'utf8')
}

/**
 * Write a project's Python test file under python/tests/<app>/ and record its
 * location on meta.json. `app` is resolved from the project's own metadata
 * (meta.app, falling back to its linked test case's app, then a neutral
 * 'app' folder) — never from the caller — so the file always lands next to
 * the app's shared page objects. Returns the posix-relative (to
 * automation-hub/) path written.
 */
export async function savePyTest(name: string, code: string): Promise<string> {
  const meta = await readMeta(name)
  if (!meta) throw new Error(`Unknown project "${name}"`)
  const app = meta.app ?? meta.linkedTestcase?.app ?? 'app'
  const relPath = pyTestRelPath(app, name)
  const fullPath = path.join(HUB_ROOT, relPath)
  await fs.mkdir(path.dirname(fullPath), { recursive: true })
  await fs.writeFile(fullPath, code, 'utf8')
  await withMetaLock(name, async () => {
    const fresh = await readMeta(name)
    if (!fresh) throw new Error(`Unknown project "${name}"`)
    await writeMeta({ ...fresh, pyTestPath: relPath })
  })
  return relPath
}

/** @deprecated alias for savePyTest, kept for any not-yet-migrated callers. */
export const savePySpec = savePyTest

// ─── Python page-object files (automation-hub/python/pages/<app>/*.py) ─────
//
// Shared, app-level page objects that generated/revised tests call into.
// `relPath` below is always relative to PYTHON_ROOT, e.g. "pages/<app>/login_page.py".

const PAGE_FILE_RE = /^pages\/[a-z0-9_-]+\/[a-z0-9_]+\.py$/

/** Throws if `relPath` isn't a well-formed pages/<app>/<file>.py path (path-traversal guard). */
function assertValidPageRelPath(relPath: string): void {
  if (!PAGE_FILE_RE.test(relPath)) {
    throw new Error(`Invalid page file path "${relPath}"`)
  }
}

/** List an app's page-object files (rel paths, __init__.py excluded). [] if the dir is missing. */
export async function listPageFiles(app: string): Promise<string[]> {
  const dir = path.join(PYTHON_ROOT, 'pages', app)
  if (!(await exists(dir))) return []
  const entries = await fs.readdir(dir, { withFileTypes: true })
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.py') && e.name !== '__init__.py')
    .map((e) => `pages/${app}/${e.name}`)
    .sort()
}

export async function readPageFile(relPath: string): Promise<string> {
  assertValidPageRelPath(relPath)
  return fs.readFile(path.join(PYTHON_ROOT, relPath), 'utf8')
}

/** Overwrite an existing page file (used by the in-app editor). Never creates new files. */
export async function savePageFile(relPath: string, content: string): Promise<void> {
  assertValidPageRelPath(relPath)
  const fullPath = path.join(PYTHON_ROOT, relPath)
  if (!(await exists(fullPath))) throw new Error(`Page file "${relPath}" does not exist`)
  await fs.writeFile(fullPath, content, 'utf8')
}

/** Append a generated method block to the end of an existing page file. */
export async function appendToPageFile(relPath: string, block: string): Promise<void> {
  assertValidPageRelPath(relPath)
  const fullPath = path.join(PYTHON_ROOT, relPath)
  let current: string
  try {
    current = await fs.readFile(fullPath, 'utf8')
  } catch {
    throw new Error(`Page file "${relPath}" does not exist`)
  }
  if (current && !current.endsWith('\n')) current += '\n'
  await fs.writeFile(fullPath, `${current}\n${block}\n`, 'utf8')
}

/**
 * Apply a codegen/revision result: save the test file and best-effort append each
 * page-object method block. Invalid or missing page paths are skipped (and simply
 * omitted from `touchedPages`) rather than failing the whole call — a bad append
 * target shouldn't lose the generated test.
 */
export async function applyPyArtifacts(
  name: string,
  artifacts: { test: string; pageAppends: Array<{ path: string; methods: string }> },
): Promise<{ pyTestPath: string; touchedPages: string[] }> {
  const pyTestPath = await savePyTest(name, artifacts.test)
  const touchedPages: string[] = []
  for (const append of artifacts.pageAppends) {
    try {
      await appendToPageFile(append.path, append.methods)
      touchedPages.push(append.path)
    } catch {
      // invalid path or missing target file — skip, don't fail the whole call
    }
  }
  return { pyTestPath, touchedPages }
}

// ─── TS page-object files (automation-hub/pages/<app>/<screen>.page.ts) ────
//
// Shared, app-level page objects that generated/revised fluent tests call into —
// the TS analog of the Python page-file functions just above. `relPath` below is
// always relative to HUB_ROOT (not python/), e.g. "pages/myapp/item-create.page.ts".
// The framework files under lib/framework/ are structurally unwritable through
// this path family: TS_PAGE_FILE_RE only ever admits paths under "pages/".

export const TS_PAGE_FILE_RE = /^pages\/[a-z0-9-]+\/[a-z0-9-]+\.page\.ts$/

/** Throws if `relPath` isn't a well-formed pages/<app>/<screen>.page.ts path (path-traversal guard). */
function assertValidTsPageRelPath(relPath: string): void {
  if (!TS_PAGE_FILE_RE.test(relPath)) {
    throw new Error(`Invalid TS page file path "${relPath}"`)
  }
}

/** List an app's TS page-object files (rel paths, sorted). [] if the app has no pages/ dir yet. */
export async function listTsPageFiles(app: string): Promise<string[]> {
  const dir = path.join(HUB_ROOT, 'pages', app)
  if (!(await exists(dir))) return []
  const entries = await fs.readdir(dir, { withFileTypes: true })
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.page.ts'))
    .map((e) => `pages/${app}/${e.name}`)
    .sort()
}

export async function readTsPageFile(relPath: string): Promise<string> {
  assertValidTsPageRelPath(relPath)
  return fs.readFile(path.join(HUB_ROOT, relPath), 'utf8')
}

/**
 * Write a TS page-object file. Unlike the Python `savePageFile` (which only ever
 * overwrites an existing file), this can also CREATE a new page file when
 * `opts.create` is true — used for the "new page" scaffold flow and `(new)`
 * codegen artifacts. Plain saves (no `create`) still require the file to
 * already exist, matching the in-app editor's semantics; `create: true` throws
 * if the file already exists, so callers never silently clobber a mined page.
 */
export async function saveTsPageFile(
  relPath: string,
  content: string,
  opts?: { create?: boolean },
): Promise<void> {
  assertValidTsPageRelPath(relPath)
  const fullPath = path.join(HUB_ROOT, relPath)
  const already = await exists(fullPath)
  if (opts?.create) {
    if (already) throw new Error(`Page file "${relPath}" already exists`)
  } else if (!already) {
    throw new Error(`Page file "${relPath}" does not exist`)
  }
  await fs.mkdir(path.dirname(fullPath), { recursive: true })
  await fs.writeFile(fullPath, content, 'utf8')
}

// Matches a top-level class-member declaration line inside a 2-space-indented
// TS class body, e.g. "  async fillItemName(name: string) {" or
// "  private _resolveTextbox<T>(...)" — captures the member name. Used both to
// read the EXISTING members of a page file (duplicate-append guard) and to
// split an INCOMING methods block into individually-addressable methods.
const CLASS_MEMBER_RE = /^\s{2}(?:private\s+|protected\s+|static\s+|async\s+)*(\w+)\s*[(<]/gm

/** Every top-level member name already declared in a page file's source. */
function existingMemberNames(content: string): Set<string> {
  const names = new Set<string>()
  const re = new RegExp(CLASS_MEMBER_RE)
  let m: RegExpExecArray | null
  while ((m = re.exec(content))) names.add(m[1])
  return names
}

/**
 * Split a generated methods block (2-space-indented, possibly several methods
 * back to back) into individual `{ name, text }` method chunks, at each
 * top-level member-declaration line. Any content before the first recognized
 * method header (stray blank lines/comments) is dropped — codegen only ever
 * emits methods-only blocks here.
 */
function splitIncomingMethods(block: string): Array<{ name: string; text: string }> {
  const lines = block.split(/\r?\n/)
  const methods: Array<{ name: string; text: string }> = []
  let current: string[] | null = null
  let currentName = ''
  const singleLineRe = new RegExp(CLASS_MEMBER_RE.source)

  for (const line of lines) {
    const m = singleLineRe.exec(line)
    if (m) {
      if (current) methods.push({ name: currentName, text: current.join('\n') })
      current = [line]
      currentName = m[1]
    } else if (current) {
      current.push(line)
    }
  }
  if (current) methods.push({ name: currentName, text: current.join('\n') })
  return methods
}

/**
 * Append a generated methods block to the end of an existing TS page file's
 * class body.
 *
 * Algorithm (see the approved plan): read the file; verify its trimmed content
 * ends with `}` (else it doesn't look like a well-formed class file — throw);
 * collect the file's existing top-level member names; split the incoming
 * `methods` block into individual methods and DROP any whose name already
 * exists (a duplicate member is a TS compile error, not a silent override like
 * the Python append) — this also makes double-mining a session's page methods
 * a no-op; insert whatever remains just before the file's FINAL closing brace.
 * Throws on a malformed target file; callers apply this best-effort (see
 * `applyTsArtifacts`) so one bad append never loses the generated test.
 */
export async function appendToTsPageFile(relPath: string, methods: string): Promise<void> {
  assertValidTsPageRelPath(relPath)
  const fullPath = path.join(HUB_ROOT, relPath)
  let current: string
  try {
    current = await fs.readFile(fullPath, 'utf8')
  } catch {
    throw new Error(`Page file "${relPath}" does not exist`)
  }

  const trimmed = current.trimEnd()
  if (!trimmed.endsWith('}')) {
    throw new Error(`Page file "${relPath}" does not look like a well-formed class file (no trailing "}")`)
  }

  const existing = existingMemberNames(current)
  const incoming = splitIncomingMethods(methods).filter((m) => m.name && !existing.has(m.name))
  if (incoming.length === 0) return // every incoming method already exists — nothing to add

  const block = incoming.map((m) => m.text.replace(/^\n+|\s+$/g, '')).join('\n\n')
  const lastBraceIdx = trimmed.lastIndexOf('}')
  const head = trimmed.slice(0, lastBraceIdx).replace(/\s+$/, '')
  const tail = trimmed.slice(lastBraceIdx)
  await fs.writeFile(fullPath, `${head}\n\n${block}\n${tail}\n`, 'utf8')
}

/**
 * Apply a TS codegen/revision result: save the test file, then best-effort
 * apply each page append — `(append)` blocks go through `appendToTsPageFile`
 * (skipped + warned if the target file is missing/malformed), `(new)` blocks
 * go through `saveTsPageFile({create: true})` (skipped + warned if the path
 * already exists — this NEVER clobbers a page file, mined or hand-written).
 * Invalid paths are skipped the same way. Mirrors `applyPyArtifacts`'s
 * best-effort semantics: a bad page target never loses the generated test.
 */
export async function applyTsArtifacts(
  name: string,
  artifacts: TsArtifacts,
): Promise<{ touchedPages: string[] }> {
  await saveSpec(name, artifacts.test)
  const touchedPages: string[] = []
  for (const append of artifacts.pageAppends) {
    try {
      if (append.mode === 'append') {
        await appendToTsPageFile(append.path, append.body)
      } else {
        await saveTsPageFile(append.path, append.body, { create: true })
      }
      touchedPages.push(append.path)
    } catch (err) {
      console.warn(
        `[applyTsArtifacts] skipping page ${append.mode} "${append.path}": ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }
  return { touchedPages }
}

export async function deleteProject(name: string): Promise<void> {
  await fs.rm(projectDir(name), { recursive: true, force: true })
}
