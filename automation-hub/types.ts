/**
 * Automation Hub — shared types.
 *
 * The Automation Hub is intentionally self-contained in this top-level folder so it
 * can be developed and reasoned about independently of the dashboard. The Next.js
 * app touches it only through thin route/page shims that import from here.
 *
 * Two engines (see README.md):
 *   - Authoring (first run): Claude + Playwright MCP drives a live browser, then a
 *     .spec.ts is generated. (Phase 2+, not in this file yet.)
 *   - Replay (rerun): `playwright test` child process — deterministic, records
 *     video + trace. Implemented in engine/runner.ts.
 *
 * There are now two ENGINE FAMILIES: Playwright (web) and Appium (Android), each
 * with its own authoring+replay pair. See `AutomationEngine` / `AppiumTarget` below.
 */

export type RunStatus = 'pass' | 'fail' | 'never_run'

/** How an automation project was created. */
export type CreatedVia = 'manual' | 'testcase' | 'chat'

/** Which automation engine drives this project. Absent = 'playwright' (all legacy projects). */
export type AutomationEngine = 'playwright' | 'appium'

/** Appium-specific target config; present only when ProjectMeta.engine === 'appium'. */
export interface AppiumTarget {
  /**
   * Absolute or hub-relative path to the local APK to install & launch.
   * Optional when the app is already installed on the target device —
   * appPackage + appActivity must be provided in that case instead. See
   * validateAppiumTarget.
   */
  apkPath?: string
  /** Optional overrides; when omitted Appium auto-detects from the APK. */
  appPackage?: string
  appActivity?: string
  /** AVD name override; falls back to the ANDROID_AVD env var when absent. */
  avd?: string
  /**
   * adb serial of a real device (e.g. "R58M12ABCDE") to drive instead of the
   * local emulator. When set, the emulator is skipped entirely — see
   * engine/appium/device.ts's resolveDevice.
   */
  udid?: string
  /** Skip Appium's default app-data reset between sessions when true. */
  noReset?: boolean
}

/**
 * Validate an AppiumTarget before a run/authoring session starts. Returns
 * null when valid, else a human-readable error message. Valid iff an APK
 * path is given, or both appPackage and appActivity are given for a
 * pre-installed app.
 */
export function validateAppiumTarget(t: AppiumTarget): string | null {
  if (t.apkPath) return null
  if (t.appPackage && t.appActivity) return null
  return 'An APK path is required unless both appPackage and appActivity are provided for a pre-installed app.'
}

/** A single recorded execution of a project's spec. */
export interface RunRecord {
  /** Filesystem-safe timestamp, also the run folder name, e.g. "2026-06-29T14-03-22-123Z". */
  ts: string
  status: Exclude<RunStatus, 'never_run'>
  durationMs: number
  /** True when a video.webm exists for this run. */
  hasVideo: boolean
  /** True when a trace.zip exists for this run. */
  hasTrace: boolean
  /** First error message, if the run failed. */
  error?: string
}

/**
 * Full reference to a dashboard test case. Execution status is keyed by
 * (app, feature, testcaseId), so all three are needed to sync pass/fail back.
 */
export interface LinkedTestcase {
  app: string
  feature: string
  testcaseId: string
}

/** Persisted per-project metadata (projects/<name>/meta.json). */
export interface ProjectMeta {
  /** Folder name == user-chosen project name (slugified). */
  name: string
  /** Human title as the user typed it. */
  title: string
  /** Dashboard app slug this automation belongs to; absent on legacy projects. */
  app?: string
  createdVia: CreatedVia
  /** Display label for a linked test case (e.g. "TC-142"); null for free-form. */
  linkedTestcaseId: string | null
  /** Full link used to sync replay pass/fail back to execution status. */
  linkedTestcase?: LinkedTestcase | null
  createdAt: string
  lastStatus: RunStatus
  /** Newest first; trimmed to MAX_RUN_HISTORY. */
  runs: RunRecord[]
  /** Free-form labels ("smoke", "orders", …) used to slice regression runs. */
  tags?: string[]
  /** Suite folder the project is filed under in the UI; null/absent = unfiled. */
  folder?: string | null
  /**
   * Posix path to this project's Python test, relative to automation-hub/, e.g.
   * "python/tests/<app>/test_example.py". Absent
   * for legacy projects whose Python spec (if any) still lives at
   * projects/<name>/test_spec.py.
   */
  pyTestPath?: string
  /** Which engine drives this project. Absent = 'playwright' (all legacy projects predate this field). */
  engine?: AutomationEngine
  /** Appium target config. Present only when engine === 'appium'. */
  appium?: AppiumTarget
}

/** A project as returned to the UI (meta + the editable spec source). */
export interface ProjectDetail extends ProjectMeta {
  spec: string
  /** Generated/translated Python spec source; null/absent when none exists. */
  pySpec?: string | null
  /**
   * Full source of every shared page-object file for this project's app
   * (automation-hub/python/pages/<app>/*.py), path relative to automation-hub/python/.
   * Present only when Python generation is enabled.
   */
  pageFiles?: Array<{ path: string; content: string }>
  /**
   * Full source of every shared TS page-object file for this project's app
   * (automation-hub/pages/<app>/*.page.ts), path relative to automation-hub/ (see
   * store.ts's TS_PAGE_FILE_RE). Present only for Playwright-engine projects.
   */
  tsPageFiles?: Array<{ path: string; content: string }>
  /**
   * Full source of the locked framework files (automation-hub/lib/framework/*.ts)
   * that every TS page object builds on — surfaced so the UI can show them as
   * read-only reference chips. Never written by API routes.
   */
  frameworkFiles?: Array<{ path: string; content: string }>
}

// ─── TS POM two-artifact codegen contract (engine/codegen.ts) ──────────────────
//
// Mirrors the Python `{ test, pageAppends }` shape but page appends are richer:
// each targets either an EXISTING page file (`mode: 'append'`, methods-only body
// inserted before the class's closing brace) or a brand-NEW page file
// (`mode: 'new'`, a complete file: imports + class). See store.ts's
// applyTsArtifacts for how these are applied.

/** One page-file edit produced alongside a generated/revised TS test. */
export interface TsPageAppend {
  /** Path relative to automation-hub/, e.g. "pages/myapp/item-create.page.ts". */
  path: string
  /** 'append' = methods-only block for an existing file; 'new' = complete file source. */
  mode: 'append' | 'new'
  /** The methods block ('append') or full file source ('new'). */
  body: string
}

/** Full result of a TS codegen/revision call: the test file plus any page-file edits. */
export interface TsArtifacts {
  /** Complete test.spec.ts source. */
  test: string
  pageAppends: TsPageAppend[]
}

/** Result returned by the runner after a replay. */
export interface RunResult {
  status: Exclude<RunStatus, 'never_run'>
  durationMs: number
  ts: string
  error?: string
  hasVideo: boolean
  hasTrace: boolean
  /** Raw stdout tail from the playwright run, for surfacing in the UI on failure. */
  log: string
}

/** Keep the last N runs per project; older run folders are pruned after each run. */
export const MAX_RUN_HISTORY = 10

// ─── MCP Chat (Phase 2) ──────────────────────────────────────────────────────

/**
 * Streamed event emitted by the MCP authoring loop, surfaced to the chat UI.
 * Serialized one-per-line as SSE `data:` frames by the chat route.
 */
export type ChatEvent =
  | { type: 'session'; sessionId: string }
  | { type: 'text'; text: string }
  | { type: 'tool_use'; tool: string; input: unknown }
  | { type: 'tool_result'; tool: string; ok: boolean; preview: string }
  | { type: 'done' }
  | { type: 'error'; message: string }

/** A turn in the chat transcript as held in the UI. */
export interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
  /** Tool activity interleaved with this assistant turn, for display. */
  tools?: { tool: string; ok: boolean }[]
}
