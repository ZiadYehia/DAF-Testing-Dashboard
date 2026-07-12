/**
 * Automation Hub — Page Object Model index for codegen (Python + TypeScript).
 *
 * PYTHON: the pytest framework is VENDORED into this repo at automation-hub/python/:
 *   - autotest_framework/src/pages/base_page.py   — the BasePage every page extends
 *   - pages/<app>/*.py                            — shared, per-app page objects
 *
 * TYPESCRIPT: the fluent Playwright framework lives at the top of automation-hub/:
 *   - lib/framework/*.ts                          — LOCKED chain core + action/assertion
 *                                                    helpers every page object calls
 *   - pages/<app>/*.page.ts                        — shared, per-app fluent page objects
 *
 * Both `getPomIndex` (Python) and `getTsPomIndex` (TypeScript) scan their respective
 * folders and produce a compact text summary (class name, base class, public/protected
 * member signatures + first doc-comment line) that gets injected into the matching
 * codegen prompt in engine/codegen.ts, so generated specs reuse existing page-object
 * methods instead of inventing raw selectors.
 *
 * AUTOTEST_FRAMEWORK_ROOT (a checkout of an external Python Playwright framework) is
 * kept as an OPTIONAL extra source for the Python index only: when set and valid, its
 * core/autotest_framework/src/pages/** page objects are appended to the index too,
 * clearly headed as external so the model doesn't confuse them with the vendored ones.
 *
 * This is pure text/regex parsing over .py/.ts source — we never import, execute, or
 * type-check either language. Errors (missing root, unreadable files, multi-line
 * signatures the regexes don't handle, etc.) are swallowed; callers get '' (or []) and
 * codegen simply omits/limits the "available page objects" section of the prompt.
 */
import fs from 'fs'
import path from 'path'
import { HUB_ROOT } from '../store'
import { parseEnvFile } from './env'

const PYTHON_ROOT = path.join(HUB_ROOT, 'python')
const PAGES_DIR = path.join(PYTHON_ROOT, 'pages')
const BASE_PAGE_FILE = path.join(PYTHON_ROOT, 'autotest_framework', 'src', 'pages', 'base_page.py')
const EXTERNAL_PAGES_SUBPATH = ['core', 'autotest_framework', 'src', 'pages']

const TS_PAGES_DIR = path.join(HUB_ROOT, 'pages')
const TS_FRAMEWORK_DIR = path.join(HUB_ROOT, 'lib', 'framework')

const MAX_INDEX_CHARS = 20_000
const TRUNCATION_MARKER = '\n... (truncated)'

/** Read AUTOTEST_FRAMEWORK_ROOT the same way other hub env vars are surfaced Next-side. */
function readFrameworkRoot(): string {
  if (process.env.AUTOTEST_FRAMEWORK_ROOT) return process.env.AUTOTEST_FRAMEWORK_ROOT
  try {
    const raw = fs.readFileSync(path.join(HUB_ROOT, '.env'), 'utf8')
    return parseEnvFile(raw).AUTOTEST_FRAMEWORK_ROOT ?? ''
  } catch {
    return ''
  }
}

/** True when the vendored framework's pages folder exists (Python generation is available). */
export function isPythonEnabled(): boolean {
  try {
    return fs.statSync(PAGES_DIR).isDirectory()
  } catch {
    return false
  }
}

/** True when AUTOTEST_FRAMEWORK_ROOT is set and points at an existing directory. */
function externalFrameworkEnabled(): boolean {
  try {
    const root = readFrameworkRoot()
    if (!root) return false
    return fs.statSync(root).isDirectory()
  } catch {
    return false
  }
}

function externalPagesDirFor(root: string): string {
  return path.join(root, ...EXTERNAL_PAGES_SUBPATH)
}

/** Recursively collect files under dir matching `suffix` (includes nested folders). */
function walkFiles(dir: string, suffix: string): string[] {
  const out: string[] = []
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === '__pycache__' || entry.name === 'node_modules') continue
      out.push(...walkFiles(full, suffix))
    } else if (entry.isFile() && entry.name.endsWith(suffix)) {
      out.push(full)
    }
  }
  return out
}

const walkPyFiles = (dir: string): string[] => walkFiles(dir, '.py')

/** Decorator lines (trimmed, with leading @) directly above a def/property line. */
function collectDecorators(lines: string[], lineIdx: number): string[] {
  const decorators: string[] = []
  let j = lineIdx - 1
  while (j >= 0) {
    const trimmed = lines[j].trim()
    if (trimmed === '') {
      j--
      continue
    }
    if (trimmed.startsWith('@')) {
      decorators.push(trimmed)
      j--
      continue
    }
    break
  }
  return decorators
}

/** First line of the docstring immediately following a def/class line, if any. */
function firstDocstringLine(lines: string[], defLineIdx: number): string | undefined {
  let j = defLineIdx + 1
  while (j < lines.length && lines[j].trim() === '') j++
  if (j >= lines.length) return undefined

  const m = /^\s*("""|''')(.*)$/.exec(lines[j])
  if (!m) return undefined
  const quote = m[1]
  let rest = m[2]

  const closeIdx = rest.indexOf(quote)
  if (closeIdx !== -1) {
    const text = rest.slice(0, closeIdx).trim()
    return text || undefined
  }

  const text = rest.trim()
  if (text) return text

  // Opening quote alone on its own line — the next line carries the first text.
  const next = lines[j + 1]
  if (next === undefined) return undefined
  if (next.includes(quote)) {
    return next.replace(quote, '').trim() || undefined
  }
  return next.trim() || undefined
}

const CLASS_RE = /^class\s+(\w+)\s*(?:\(([^)]*)\))?\s*:\s*$/
const DEF_RE = /^(\s+)def\s+(\w+)\s*\(([^)]*)\)\s*(?:->\s*([^:]+?))?\s*:\s*$/
const PROPERTY_DECORATOR_RE = /^@property\b/

interface ClassBlock {
  name: string
  base: string
  properties: string[]
  methods: { signature: string; doc?: string }[]
}

/** Parse one .py file into a compact text block, or '' if it defines no classes. */
function parsePyFile(filePath: string, relPath: string): string {
  let content: string
  try {
    content = fs.readFileSync(filePath, 'utf8')
  } catch {
    return ''
  }
  const lines = content.split(/\r?\n/)

  const classes: ClassBlock[] = []
  let current: ClassBlock | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    const classMatch = CLASS_RE.exec(line)
    if (classMatch) {
      const base = classMatch[2] ? classMatch[2].split(',')[0].trim() : ''
      current = { name: classMatch[1], base, properties: [], methods: [] }
      classes.push(current)
      continue
    }

    if (!current) continue

    const defMatch = DEF_RE.exec(line)
    if (!defMatch) continue
    const [, , name, params, returnType] = defMatch
    if (name === '__init__') continue

    const decorators = collectDecorators(lines, i)
    const isProperty = decorators.some((d) => PROPERTY_DECORATOR_RE.test(d))

    if (isProperty) {
      current.properties.push(name)
      continue
    }

    const signature = `def ${name}(${params.trim()})${returnType ? ` -> ${returnType.trim()}` : ''}`
    const doc = firstDocstringLine(lines, i)
    current.methods.push({ signature, doc })
  }

  if (classes.length === 0) return ''

  const parts: string[] = [`### ${relPath}`]
  for (const cls of classes) {
    parts.push(`class ${cls.name}${cls.base ? `(${cls.base})` : ''}:`)
    if (cls.properties.length) {
      parts.push(`  properties: ${cls.properties.join(', ')}`)
    }
    for (const m of cls.methods) {
      parts.push(`  ${m.signature}${m.doc ? `  # ${m.doc}` : ''}`)
    }
  }
  return parts.join('\n')
}

/** Vendored page files relevant to `app` (all apps when omitted), plus base_page.py, sorted. */
function vendoredFilesFor(app?: string): string[] {
  const files: string[] = []
  try {
    if (fs.statSync(BASE_PAGE_FILE).isFile()) files.push(BASE_PAGE_FILE)
  } catch {
    /* base page missing — skip */
  }
  const scanDir = app ? path.join(PAGES_DIR, app) : PAGES_DIR
  files.push(...walkPyFiles(scanDir))
  return files
}

// ─── TypeScript (.page.ts / lib/framework) parsing ─────────────────────────────
//
// Regex-only, single-logical-line signatures only (mirrors the Python parser's own
// limitation above) — a method/function whose signature spans multiple source lines
// (e.g. FluentPage's `stepTo`/`then`) is silently skipped rather than mis-parsed. The
// framework's *conventions* prose (see engine/codegen.ts's tsConventions) documents
// those primitives' usage directly, so the gap doesn't leave the model unguided.

const TS_CLASS_RE = /^export\s+(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?/
const TS_MEMBER_RE =
  /^ {2}(?:(private|protected|public)\s+)?(?:(static)\s+)?(?:(async)\s+)?(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)\s*(?::\s*([^{;]+?))?\s*[{;]\s*$/
const TS_FUNCTION_RE =
  /^export\s+(async\s+)?function\s+(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)\s*(?::\s*([^{]+?))?\s*\{\s*$/

interface TsClassBlock {
  name: string
  base: string
  methods: { signature: string; doc?: string }[]
}

/** First line of a JSDoc comment block immediately above a member/function line, if any. */
function jsDocAbove(lines: string[], defLineIdx: number): string | undefined {
  let j = defLineIdx - 1
  while (j >= 0 && lines[j].trim() === '') j--
  if (j < 0) return undefined
  const trimmed = lines[j].trim()
  if (!trimmed.endsWith('*/')) return undefined

  // Single-line JSDoc: /** text */
  const singleLine = /^\/\*\*\s*(.*?)\s*\*\/$/.exec(trimmed)
  if (singleLine) return singleLine[1] || undefined

  // Multi-line: walk up to the opening /**, first non-empty content line wins.
  let k = j
  while (k >= 0 && !lines[k].trim().startsWith('/**')) k--
  if (k < 0) return undefined
  const openLine = lines[k].trim().replace(/^\/\*\*\s*/, '')
  if (openLine) {
    const cleaned = openLine.replace(/\*\/$/, '').trim()
    if (cleaned) return cleaned
  }
  for (let m = k + 1; m <= j; m++) {
    const content = lines[m].trim().replace(/^\*\s?/, '').replace(/\*\/$/, '').trim()
    if (content) return content
  }
  return undefined
}

/** Parse one framework/page .ts file into a compact text block, or '' if nothing exported. */
function parseTsFile(filePath: string, relPath: string): string {
  let content: string
  try {
    content = fs.readFileSync(filePath, 'utf8')
  } catch {
    return ''
  }
  const lines = content.split(/\r?\n/)

  const classes: TsClassBlock[] = []
  let current: TsClassBlock | null = null
  const topFunctions: { signature: string; doc?: string }[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    const classMatch = TS_CLASS_RE.exec(line)
    if (classMatch) {
      current = { name: classMatch[1], base: classMatch[2] ?? '', methods: [] }
      classes.push(current)
      continue
    }

    if (current) {
      const memberMatch = TS_MEMBER_RE.exec(line)
      if (memberMatch) {
        const [, visibility, isStatic, isAsync, name, params, returnType] = memberMatch
        if (visibility !== 'private' && name !== 'constructor') {
          const signature = `${isStatic ? 'static ' : ''}${isAsync ? 'async ' : ''}${name}(${params.trim()})${
            returnType ? `: ${returnType.trim()}` : ''
          }`
          current.methods.push({ signature, doc: jsDocAbove(lines, i) })
        }
        continue
      }
    }

    const fnMatch = TS_FUNCTION_RE.exec(line)
    if (fnMatch) {
      const [, isAsync, name, params, returnType] = fnMatch
      const signature = `${isAsync ? 'async ' : ''}function ${name}(${params.trim()})${
        returnType ? `: ${returnType.trim()}` : ''
      }`
      topFunctions.push({ signature, doc: jsDocAbove(lines, i) })
    }
  }

  if (classes.length === 0 && topFunctions.length === 0) return ''

  const parts: string[] = [`### ${relPath}`]
  for (const cls of classes) {
    parts.push(`class ${cls.name}${cls.base ? ` extends ${cls.base}` : ''}:`)
    for (const m of cls.methods) {
      parts.push(`  ${m.signature}${m.doc ? `  # ${m.doc}` : ''}`)
    }
  }
  for (const fn of topFunctions) {
    parts.push(`${fn.signature}${fn.doc ? `  # ${fn.doc}` : ''}`)
  }
  return parts.join('\n')
}

/** `pages/<app>/*.page.ts` files (all apps' page files when `app` omitted), sorted. */
function tsPageFilesFor(app?: string): string[] {
  if (!app) {
    let appDirs: fs.Dirent[]
    try {
      appDirs = fs.readdirSync(TS_PAGES_DIR, { withFileTypes: true })
    } catch {
      return []
    }
    const out: string[] = []
    for (const d of appDirs) {
      if (d.isDirectory()) out.push(...tsPageFilesFor(d.name))
    }
    return out
  }
  const dir = path.join(TS_PAGES_DIR, app)
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.page.ts'))
    .map((e) => path.join(dir, e.name))
}

/** `lib/framework/*.ts` files, sorted. */
function tsFrameworkFiles(): string[] {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(TS_FRAMEWORK_DIR, { withFileTypes: true })
  } catch {
    return []
  }
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.ts'))
    .map((e) => path.join(TS_FRAMEWORK_DIR, e.name))
    .sort()
}

// ─── Shared mtime-keyed cache (Python + TypeScript indexes) ────────────────────
//
// A single module-scope Map keyed `py::<app|*>::<externalPagesDir>` / `ts::<app|*>`
// so both languages' indexes cache independently without colliding on the same key.

interface CacheEntry {
  maxMtimeMs: number
  text: string
}

const cache = new Map<string, CacheEntry>()

/**
 * Compact text summary of the vendored page objects under automation-hub/python/pages/**
 * (scoped to `app` when given) plus autotest_framework/src/pages/base_page.py, with an
 * optional extra section for AUTOTEST_FRAMEWORK_ROOT's external page objects when that
 * env var is configured. Injected into the Python codegen prompt so the model reuses
 * existing page-object methods instead of raw selectors. Returns '' when no vendored
 * pages exist and no external framework is configured, or on any filesystem error.
 * Cached in the shared module-scope Map, keyed by app + the newest file mtime across
 * both roots — a touched/added/removed file triggers a re-scan.
 */
export function getPomIndex(app?: string): string {
  try {
    const vendoredFiles = vendoredFilesFor(app)
    const externalRoot = externalFrameworkEnabled() ? readFrameworkRoot() : ''
    const externalPagesDir = externalRoot ? externalPagesDirFor(externalRoot) : ''
    const externalFiles = externalPagesDir ? walkPyFiles(externalPagesDir) : []

    if (vendoredFiles.length === 0 && externalFiles.length === 0) return ''

    let maxMtimeMs = 0
    for (const f of [...vendoredFiles, ...externalFiles]) {
      try {
        const mtime = fs.statSync(f).mtimeMs
        if (mtime > maxMtimeMs) maxMtimeMs = mtime
      } catch {
        /* file vanished mid-scan — ignore */
      }
    }

    const key = `py::${app ?? '*'}::${externalPagesDir}`
    const cached = cache.get(key)
    if (cached && cached.maxMtimeMs === maxMtimeMs) return cached.text

    const blocks: string[] = []
    for (const f of vendoredFiles.sort()) {
      const relPath = path.relative(PYTHON_ROOT, f).split(path.sep).join('/')
      const block = parsePyFile(f, relPath)
      if (block) blocks.push(block)
    }

    if (externalFiles.length > 0) {
      const externalBlocks: string[] = []
      for (const f of externalFiles.sort()) {
        const relPath = path.relative(externalPagesDir, f).split(path.sep).join('/')
        const block = parsePyFile(f, relPath)
        if (block) externalBlocks.push(block)
      }
      if (externalBlocks.length > 0) {
        blocks.push(
          `### EXTERNAL (AUTOTEST_FRAMEWORK_ROOT — not part of the vendored framework)\n` +
            externalBlocks.join('\n\n'),
        )
      }
    }

    let text = blocks.join('\n\n')
    if (text.length > MAX_INDEX_CHARS) {
      text = text.slice(0, MAX_INDEX_CHARS) + TRUNCATION_MARKER
    }

    cache.set(key, { maxMtimeMs, text })
    return text
  } catch {
    return ''
  }
}

/**
 * Compact text summary of `pages/<app>/*.page.ts` (scoped to `app` when given) PLUS
 * `lib/framework/*.ts` (the locked chain core + action/assertion helpers), the latter
 * under its own `### FRAMEWORK (locked — call these, never redefine)` heading. Injected
 * into the TS codegen prompt (see engine/codegen.ts's tsConventions) so the model reuses
 * existing page-object methods and framework helpers instead of raw Playwright calls.
 * Same architecture as `getPomIndex`: mtime-keyed cache (shared Map, `ts::` prefix),
 * 20k-char cap, '' on any filesystem error.
 */
export function getTsPomIndex(app?: string): string {
  try {
    const pageFiles = tsPageFilesFor(app)
    const frameworkFiles = tsFrameworkFiles()

    if (pageFiles.length === 0 && frameworkFiles.length === 0) return ''

    let maxMtimeMs = 0
    for (const f of [...pageFiles, ...frameworkFiles]) {
      try {
        const mtime = fs.statSync(f).mtimeMs
        if (mtime > maxMtimeMs) maxMtimeMs = mtime
      } catch {
        /* file vanished mid-scan — ignore */
      }
    }

    const key = `ts::${app ?? '*'}`
    const cached = cache.get(key)
    if (cached && cached.maxMtimeMs === maxMtimeMs) return cached.text

    const blocks: string[] = []
    for (const f of pageFiles.sort()) {
      const relPath = path.relative(HUB_ROOT, f).split(path.sep).join('/')
      const block = parseTsFile(f, relPath)
      if (block) blocks.push(block)
    }

    if (frameworkFiles.length > 0) {
      const frameworkBlocks: string[] = []
      for (const f of frameworkFiles) {
        const relPath = path.relative(HUB_ROOT, f).split(path.sep).join('/')
        const block = parseTsFile(f, relPath)
        if (block) frameworkBlocks.push(block)
      }
      if (frameworkBlocks.length > 0) {
        blocks.push(`### FRAMEWORK (locked — call these, never redefine)\n` + frameworkBlocks.join('\n\n'))
      }
    }

    let text = blocks.join('\n\n')
    if (text.length > MAX_INDEX_CHARS) {
      text = text.slice(0, MAX_INDEX_CHARS) + TRUNCATION_MARKER
    }

    cache.set(key, { maxMtimeMs, text })
    return text
  } catch {
    return ''
  }
}

/**
 * Every pages/<app>/*.py file's full content (path relative to automation-hub/python/,
 * __init__.py excluded), for callers (revisePySpec) that need to hand the model complete
 * page-object source rather than the compact signature index. Sync, [] on any error.
 */
export function listPageFileContents(app: string): Array<{ path: string; content: string }> {
  try {
    const dir = path.join(PAGES_DIR, app)
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return []
    }
    const out: Array<{ path: string; content: string }> = []
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.py') || entry.name === '__init__.py') continue
      const full = path.join(dir, entry.name)
      try {
        const content = fs.readFileSync(full, 'utf8')
        const relPath = path.relative(PYTHON_ROOT, full).split(path.sep).join('/')
        out.push({ path: relPath, content })
      } catch {
        /* unreadable file — skip */
      }
    }
    return out
  } catch {
    return []
  }
}

/**
 * Every pages/<app>/*.page.ts file's full content (path relative to automation-hub/,
 * e.g. "pages/myapp/item-create.page.ts"), for callers (reviseSpec) that need complete
 * page-object source rather than the compact signature index. Sync, [] on any error.
 */
export function listTsPageFileContents(app: string): Array<{ path: string; content: string }> {
  try {
    const dir = path.join(TS_PAGES_DIR, app)
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return []
    }
    const out: Array<{ path: string; content: string }> = []
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.page.ts')) continue
      const full = path.join(dir, entry.name)
      try {
        const content = fs.readFileSync(full, 'utf8')
        const relPath = path.relative(HUB_ROOT, full).split(path.sep).join('/')
        out.push({ path: relPath, content })
      } catch {
        /* unreadable file — skip */
      }
    }
    return out
  } catch {
    return []
  }
}

/**
 * Every lib/framework/*.ts file's full content (path relative to automation-hub/, e.g.
 * "lib/framework/actions.ts"), for the read-only "locked framework" UI chips. Sync, []
 * on any error.
 */
export function listFrameworkFileContents(): Array<{ path: string; content: string }> {
  try {
    const files = tsFrameworkFiles()
    const out: Array<{ path: string; content: string }> = []
    for (const f of files) {
      try {
        const content = fs.readFileSync(f, 'utf8')
        const relPath = path.relative(HUB_ROOT, f).split(path.sep).join('/')
        out.push({ path: relPath, content })
      } catch {
        /* unreadable file — skip */
      }
    }
    return out
  } catch {
    return []
  }
}
