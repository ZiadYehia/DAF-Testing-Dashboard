import { NextRequest, NextResponse } from 'next/server'
import { engineFamily } from '@automation-hub/types'
import { guardApp } from '@/lib/auth'
import { getProject } from '@automation-hub/store'
import { runProject as runPlaywright, isRunning as isRunningPlaywright } from '@automation-hub/engine/runner'
import { runProject as runAppium, isRunning as isRunningAppium } from '@automation-hub/engine/appium-runner'
import { setExecutionStatus, appendExecutionNoteLine } from '@/lib/execution'
import { isInfrastructureFailure } from '@/lib/infrastructure-failure.cjs'
import { activeEnvironmentVars, activeEnvironmentName } from '@/lib/environments'
import { buildAutomationFailureNote, AUTOMATION_NOTE_PREFIX } from '@/lib/automation-run-note'

export const runtime = 'nodejs'
// 300s: shared by both engines on this route. A browser run can take up to the
// config's 60s timeout plus startup overhead, but an Appium run also boots an
// emulator + Appium server first, which needs more headroom than 120s allowed.
export const maxDuration = 300

/** POST /api/[app]/automation/[project]/run — replay the spec, return the result. */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ app: string; project: string }> },
) {
  const { app, project } = await params
  const guard = await guardApp(app, 'automation.run')
  if (!guard.ok) return guard.response

  const detail = await getProject(project)
  if (!detail) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }
  // engineFamily, not `=== 'appium'`: the 'api' engine is Playwright-family (it runs on
  // the Playwright runner, browserless), so it must dispatch to runPlaywright.
  const isAppiumProject = engineFamily(detail.engine) === 'appium'
  if ((isAppiumProject ? isRunningAppium : isRunningPlaywright)(project)) {
    return NextResponse.json({ error: 'A run is already in progress' }, { status: 409 })
  }

  try {
    /**
     * Where this run should point.
     *
     * Resolved here, at the boundary that already has the Next data layer, and handed to the
     * engine — the engine must not import `@/lib/*`, because that alias does not resolve from
     * automation-hub outside the Next bundle and the failure is silent.
     *
     * Read per run rather than cached: someone can switch environments between two replays and
     * the second must go where the UI says. `{}` when nothing is active, which leaves
     * automation-hub/.env in charge exactly as before this existed.
     */
    const envOverrides = await activeEnvironmentVars(app)
    // Recorded on the run so history stays readable: without it, results from two different
    // servers sit in one list with nothing to tell them apart, and lastStatus is simply
    // whichever ran last.
    const envName = await activeEnvironmentName(app)
    const result = await (isAppiumProject ? runAppium : runPlaywright)(
      project, new Date().toISOString(), envOverrides, envName ?? undefined,
    )

    // If this automation is linked to a dashboard test case, mirror pass/fail
    // onto its execution status so automations become the regression source.
    // A run where every test was skipped (result.executed === false, e.g. a
    // test.fixme'd spec) reports `pass` for lack of any failure — that is not
    // a verified behaviour, so it must not touch status or notes at all.
    let synced: { testcaseId: string; status: string } | null = null
    const link = detail.linkedTestcase
    /**
     * An unreachable platform is not a verdict on the test case.
     *
     * The CLI recorder has always held these back; this path did not, and the gap was not
     * theoretical. TC_COMM_006 was replayed twice while the ngrok relay answered 403
     * ERR_NGROK_727 to every request — nothing behind the tunnel ran at all — and its recorded
     * status went from pass to fail, with an automation note blaming the API key.
     *
     * The run still appears in history as a failed run, which is true and useful. What must not
     * happen is a test case being marked failing because the server could not be reached.
     */
    const unreachable = result.status === 'fail' && isInfrastructureFailure(result.error)
    if (link && result.executed && !unreachable
        && (result.status === 'pass' || result.status === 'fail')) {
      // Same environment the run targeted: execution status is scoped per environment, so
      // recording an ngrok result must not land on (and overwrite) the production one.
      const res = await setExecutionStatus(
        link.app, link.feature, link.testcaseId, result.status, undefined, envName ?? undefined,
      )
      if (res.ok) synced = { testcaseId: link.testcaseId, status: result.status }
      // A human observation must survive a green run — only failures write a
      // note — and even then it is merged in, never allowed to overwrite the
      // tester's own text.
      if (result.status === 'fail') {
        await appendExecutionNoteLine(
          link.app, link.feature, link.testcaseId, buildAutomationFailureNote(result),
          { replacePrefix: AUTOMATION_NOTE_PREFIX }, undefined, envName ?? undefined,
        )
      }
    }

    // Surfaced so the UI can say "not recorded — the platform was unreachable" instead of
    // showing a failed run whose verdict silently went nowhere.
    return NextResponse.json({ ...result, synced, ...(unreachable ? { unreachable: true } : {}) })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Run failed' }, { status: 500 })
  }
}
