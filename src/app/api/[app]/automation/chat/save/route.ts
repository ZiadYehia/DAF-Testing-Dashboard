import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { guardApp } from '@/lib/auth'
import { getSetting } from '@/lib/settings'
import { getTranscript, getSessionModel, getEngine, getSessionTarget } from '@automation-hub/engine/authoring'
import { markExtracted } from '@automation-hub/engine/mcp-client'
import { mineSessionPages } from '@automation-hub/engine/page-miner'
import { generateSpec, generateSpecPython } from '@automation-hub/engine/codegen'
import { generateSpecAppium } from '@automation-hub/engine/appium-codegen'
import { createProject, applyPyArtifacts, applyTsArtifacts } from '@automation-hub/store'
import { isPythonEnabled } from '@automation-hub/lib/pom-index'

export const runtime = 'nodejs'
export const maxDuration = 120

/**
 * POST /api/[app]/automation/chat/save — turn a chat session into a saved,
 * replayable automation project. Body: { sessionId, title }.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ app: string }> },
) {
  const { app } = await params
  const guard = await guardApp(app, 'automation.edit')
  if (!guard.ok) return guard.response

  const body = await req.json().catch(() => ({}))
  const sessionId = String(body?.sessionId ?? '')
  const title = String(body?.title ?? '').trim()
  if (!sessionId || !title) {
    return NextResponse.json({ error: 'sessionId and title are required' }, { status: 400 })
  }
  // Optional link back to a dashboard test case (Mode A authoring → status sync).
  const linkedTestcase =
    body?.linkedTestcase?.feature && body?.linkedTestcase?.testcaseId
      ? { app, feature: String(body.linkedTestcase.feature), testcaseId: String(body.linkedTestcase.testcaseId) }
      : null

  const transcript = getTranscript(sessionId)
  if (!transcript) {
    return NextResponse.json({ error: 'No browser actions to save yet — drive the flow first' }, { status: 400 })
  }
  const modelId = getSessionModel(sessionId)
  if (!modelId) return NextResponse.json({ error: 'Session expired' }, { status: 400 })

  const apiKey = await getSetting(`user:${guard.access.user.id}`, 'ANTHROPIC_API_KEY')
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not configured' }, { status: 400 })

  try {
    const engine = getEngine(sessionId)
    if (engine === 'appium') {
      const target = getSessionTarget(sessionId)
      if (!target) {
        return NextResponse.json({ error: 'Session has no Appium target — try starting a new chat' }, { status: 400 })
      }
      const spec = await generateSpecAppium({ apiKey, modelId, title, actions: transcript.actions, summary: transcript.summary, app })
      const meta = await createProject({
        title,
        spec,
        app,
        createdVia: 'chat',
        linkedTestcase,
        now: new Date().toISOString(),
        engine: 'appium',
        appium: target,
      })
      // No Python-generation block here — that path is Playwright-only.
      return NextResponse.json(meta, { status: 201 })
    }

    // Mine reusable page-object methods out of this session's own actions BEFORE
    // generating the test — a synchronous, best-effort step (Phase D) so `generateSpec`
    // sees the freshly-mined methods in its POM index instead of re-inventing them
    // inline. `markExtracted` then records the watermark so a later close/reap of this
    // same session (e.g. the user closes the chat right after saving) never re-mines —
    // and thus never re-appends — the actions this save already covered.
    try {
      await mineSessionPages({
        actions: transcript.actions,
        summary: transcript.summary,
        app,
        anthropic: new Anthropic({ apiKey }),
        modelId,
        reason: 'save',
      })
    } catch (err) {
      console.error('[chat/save] page mining failed:', err)
    }
    markExtracted(sessionId, transcript.actions.length)

    const artifacts = await generateSpec({ apiKey, modelId, title, actions: transcript.actions, summary: transcript.summary, app })
    const meta = await createProject({
      title,
      spec: artifacts.test,
      app,
      createdVia: 'chat',
      linkedTestcase,
      now: new Date().toISOString(),
    })
    await applyTsArtifacts(meta.name, artifacts)
    let pyWarning: string | undefined
    if (isPythonEnabled()) {
      try {
        const artifacts = await generateSpecPython({ apiKey, modelId, title, actions: transcript.actions, summary: transcript.summary, app })
        await applyPyArtifacts(meta.name, artifacts)
      } catch (err: any) {
        pyWarning = err?.message ?? 'Failed to generate Python spec'
      }
    }
    return NextResponse.json(pyWarning ? { ...meta, pyWarning } : meta, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Failed to save automation' }, { status: 500 })
  }
}
