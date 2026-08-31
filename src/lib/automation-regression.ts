/**
 * Server-side regression runner for the Automation Hub.
 *
 * Replays every automation project (optionally filtered by app and/or tag) in
 * sequence, mirrors linked test-case pass/fail onto dashboard execution status,
 * and posts a summary to the team webhook (Settings → Automation) if configured.
 *
 * Used by the nightly scheduler (automation-scheduler.ts) and the
 * POST /api/[app]/automation/run-all route. The in-UI "Run all" keeps its own
 * client-side loop for live progress; only server-triggered regressions notify.
 */
import { listProjects } from '@automation-hub/store'
import { engineFamily } from '@automation-hub/types'
import { runProject as runPlaywright, isRunning as isRunningPlaywright } from '@automation-hub/engine/runner'
import { runProject as runAppium, isRunning as isRunningAppium } from '@automation-hub/engine/appium-runner'
import { setExecutionStatus, appendExecutionNoteLine } from './execution'
import { getSetting } from './settings'
import { writeAllAutomationCaches } from './automation-cache'
import { buildAutomationFailureNote, AUTOMATION_NOTE_PREFIX } from './automation-run-note'

export interface RegressionFailure {
  name: string
  title: string
  error?: string
}

export interface RegressionSummary {
  trigger: 'scheduled' | 'api'
  app?: string
  tag?: string
  total: number
  passed: number
  failed: number
  skipped: number
  startedAt: string
  finishedAt: string
  failures: RegressionFailure[]
}

/** Module-level lock: one regression at a time per server process. */
let regressionRunning = false
export function isRegressionRunning(): boolean {
  return regressionRunning
}

export async function runRegression(opts: {
  trigger: 'scheduled' | 'api'
  /** Only projects belonging to this app (legacy unscoped projects included). */
  app?: string
  /** Only projects carrying this tag. */
  tag?: string
}): Promise<RegressionSummary> {
  if (regressionRunning) throw new Error('A regression run is already in progress')
  regressionRunning = true
  const startedAt = new Date().toISOString()
  try {
    const projects = (await listProjects()).filter(
      (p) =>
        (!opts.app || !p.app || p.app === opts.app) &&
        (!opts.tag || (p.tags ?? []).includes(opts.tag)),
    )

    // Refresh automation.json from automation_configs before spawning any child
    // process — never blocks the run: the file already on disk is a valid
    // fallback if this fails (down DB, no rows yet, etc).
    try {
      await writeAllAutomationCaches()
    } catch (err) {
      console.warn('[automation] writeAllAutomationCaches failed — proceeding with existing automation.json files:', err)
    }

    let passed = 0
    let failed = 0
    let skipped = 0
    const failures: RegressionFailure[] = []

    for (const p of projects) {
      // engineFamily, not `=== 'appium'`: 'api' projects run on the Playwright runner.
      const isAppiumProject = engineFamily(p.engine) === 'appium'
      const isRunning = isAppiumProject ? isRunningAppium : isRunningPlaywright
      const runProject = isAppiumProject ? runAppium : runPlaywright
      if (isRunning(p.name)) {
        skipped++
        continue
      }
      try {
        const result = await runProject(p.name, new Date().toISOString())
        if (result.status === 'pass') passed++
        else {
          failed++
          failures.push({ name: p.name, title: p.title, error: result.error })
        }
        // Mirror pass/fail onto the linked dashboard test case (same as the run route).
        // Skip entirely when every test in the run was skipped (result.executed
        // === false, e.g. a test.fixme'd spec) — Playwright reports that as
        // `pass` for lack of a failure, but nothing was actually verified.
        const link = p.linkedTestcase
        if (link && result.executed) {
          await setExecutionStatus(link.app, link.feature, link.testcaseId, result.status).catch(() => {})
          // A human observation must survive a green run — only failures write a
          // note — and even then it is merged in, never allowed to overwrite the
          // tester's own text.
          if (result.status === 'fail') {
            await appendExecutionNoteLine(link.app, link.feature, link.testcaseId, buildAutomationFailureNote(result), {
              replacePrefix: AUTOMATION_NOTE_PREFIX,
            }).catch(() => {})
          }
        }
      } catch (err: any) {
        failed++
        failures.push({ name: p.name, title: p.title, error: err?.message ?? String(err) })
      }
    }

    const summary: RegressionSummary = {
      trigger: opts.trigger,
      app: opts.app,
      tag: opts.tag,
      total: projects.length,
      passed,
      failed,
      skipped,
      startedAt,
      finishedAt: new Date().toISOString(),
      failures,
    }
    await sendRegressionWebhook(summary)
    return summary
  } finally {
    regressionRunning = false
  }
}

/**
 * POST the summary to the configured webhook as `{ text }` — the shape both Slack
 * incoming webhooks and Teams (via workflow) accept. Failures are logged, never thrown:
 * a broken webhook must not fail the regression itself.
 */
async function sendRegressionWebhook(s: RegressionSummary): Promise<void> {
  const url = await getSetting('global', 'AUTOMATION_WEBHOOK_URL')
  if (!url) return

  const scope = [s.app && `app: ${s.app}`, s.tag && `tag: ${s.tag}`].filter(Boolean).join(', ')
  const headline = s.failed === 0 ? '✅ Automation regression passed' : '❌ Automation regression failed'
  const lines = [
    `${headline} (${s.trigger}${scope ? `, ${scope}` : ''})`,
    `${s.passed}/${s.total} passed · ${s.failed} failed${s.skipped ? ` · ${s.skipped} skipped` : ''}`,
    ...s.failures.slice(0, 10).map((f) => `• ${f.title}${f.error ? ` — ${f.error}` : ''}`),
    ...(s.failures.length > 10 ? [`…and ${s.failures.length - 10} more`] : []),
  ]
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: lines.join('\n') }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) console.error(`[automation] webhook responded ${res.status}`)
  } catch (err) {
    console.error('[automation] webhook delivery failed:', err)
  }
}
