import { NextRequest, NextResponse } from 'next/server'
import { engineFamily } from '@automation-hub/types'
import { guardApp } from '@/lib/auth'
import { getProject } from '@automation-hub/store'
import { runProject as runPlaywright, isRunning as isRunningPlaywright } from '@automation-hub/engine/runner'
import { runProject as runAppium, isRunning as isRunningAppium } from '@automation-hub/engine/appium-runner'
import { setExecutionStatus, appendExecutionNoteLine } from '@/lib/execution'
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
    const result = await (isAppiumProject ? runAppium : runPlaywright)(project, new Date().toISOString())

    // If this automation is linked to a dashboard test case, mirror pass/fail
    // onto its execution status so automations become the regression source.
    // A run where every test was skipped (result.executed === false, e.g. a
    // test.fixme'd spec) reports `pass` for lack of any failure — that is not
    // a verified behaviour, so it must not touch status or notes at all.
    let synced: { testcaseId: string; status: string } | null = null
    const link = detail.linkedTestcase
    if (link && result.executed && (result.status === 'pass' || result.status === 'fail')) {
      const res = await setExecutionStatus(link.app, link.feature, link.testcaseId, result.status)
      if (res.ok) synced = { testcaseId: link.testcaseId, status: result.status }
      // A human observation must survive a green run — only failures write a
      // note — and even then it is merged in, never allowed to overwrite the
      // tester's own text.
      if (result.status === 'fail') {
        await appendExecutionNoteLine(link.app, link.feature, link.testcaseId, buildAutomationFailureNote(result), {
          replacePrefix: AUTOMATION_NOTE_PREFIX,
        })
      }
    }

    return NextResponse.json({ ...result, synced })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Run failed' }, { status: 500 })
  }
}
