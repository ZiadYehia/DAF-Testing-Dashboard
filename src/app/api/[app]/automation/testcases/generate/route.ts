import { NextRequest, NextResponse } from 'next/server'
import { getApp } from '@/lib/apps'
import { guardApp } from '@/lib/auth'
import { getSetting } from '@/lib/settings'
import { getModelsWithStatusAsync } from '@/lib/ai'
import { getFeature, parseTestcaseRows } from '@/lib/features'
import { isFeatureEnabled } from '@/lib/ai-config'
import { generateSpecFromTestcase, generateSpecPythonFromTestcase } from '@automation-hub/engine/codegen'
import { createProject, applyPyArtifacts, applyTsArtifacts } from '@automation-hub/store'
import { isPythonEnabled } from '@automation-hub/lib/pom-index'

export const runtime = 'nodejs'
export const maxDuration = 120

const resolveId = (id: string) => (id === 'claude-haiku-4-5' ? 'claude-haiku-4-5-20251001' : id)

/**
 * Resolve the model to use: the caller's requested model if it's enabled, else the
 * first enabled Claude model (kept as the default since it's the best-tested path).
 * Null if nothing is configured.
 */
async function pickModel(userId: number, requested?: string): Promise<{ modelId: string; provider: string } | null> {
  const models = await getModelsWithStatusAsync(userId)
  const enabled = models.filter((x) => x.enabled)
  const match = requested ? enabled.find((m) => m.id === requested) : undefined
  const chosen = match ?? enabled.find((m) => m.provider === 'anthropic') ?? enabled[0]
  return chosen ? { modelId: resolveId(chosen.id), provider: chosen.provider } : null
}

/**
 * POST /api/[app]/automation/testcases/generate — generate a replayable spec
 * directly from a manual test case (no live browser). Body: { feature, testcaseId, title }.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ app: string }> },
) {
  const { app } = await params
  const guard = await guardApp(app, 'automation.edit')
  if (!guard.ok) return guard.response

  // Same reason as [project]/improve: generateSpecFromTestcase emits a Playwright-POM
  // browser spec with page objects and cached storage state. There is no API variant of
  // that prompt, so generating one for an API app would produce a spec that cannot run.
  if ((await getApp(app))?.type === 'api') {
    return NextResponse.json(
      { error: 'Spec generation from a test case produces a browser page-object spec, which does not apply to an API app.' },
      { status: 400 },
    )
  }
  if (!(await isFeatureEnabled(app, 'automationHub'))) {
    return NextResponse.json({ error: 'AI is disabled for this app (Settings → AI & Models)' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const feature = String(body?.feature ?? '')
  const testcaseId = String(body?.testcaseId ?? '')
  const title = String(body?.title ?? '').trim() || testcaseId
  if (!feature || !testcaseId) {
    return NextResponse.json({ error: 'feature and testcaseId are required' }, { status: 400 })
  }

  const detail = await getFeature(app, feature)
  const row = detail ? parseTestcaseRows(detail.testcases).find((r) => r.id === testcaseId) : undefined
  if (!row) return NextResponse.json({ error: 'Test case not found' }, { status: 404 })

  const picked = await pickModel(guard.access.user.id, typeof body?.model === 'string' ? body.model : undefined)
  const apiKey = picked?.provider === 'anthropic' ? (await getSetting(`user:${guard.access.user.id}`, 'ANTHROPIC_API_KEY')) ?? '' : ''
  if (!picked) {
    return NextResponse.json({ error: 'No AI model available — add a provider API key in Settings → AI & Models' }, { status: 400 })
  }

  try {
    const artifacts = await generateSpecFromTestcase({
      apiKey, modelId: picked.modelId, provider: picked.provider, title, objective: row.objective, steps: row.steps, app,
      userId: guard.access.user.id,
    })
    const meta = await createProject({
      title,
      spec: artifacts.test,
      app,
      createdVia: 'testcase',
      linkedTestcase: { app, feature, testcaseId },
      now: new Date().toISOString(),
    })
    await applyTsArtifacts(meta.name, artifacts)
    let pyWarning: string | undefined
    if (isPythonEnabled()) {
      try {
        const artifacts = await generateSpecPythonFromTestcase({
          apiKey, modelId: picked.modelId, provider: picked.provider, title, objective: row.objective, steps: row.steps, app,
          userId: guard.access.user.id,
        })
        await applyPyArtifacts(meta.name, artifacts)
      } catch (err: any) {
        pyWarning = err?.message ?? 'Failed to generate Python spec'
      }
    }
    return NextResponse.json(pyWarning ? { ...meta, pyWarning } : meta, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Failed to generate' }, { status: 500 })
  }
}
