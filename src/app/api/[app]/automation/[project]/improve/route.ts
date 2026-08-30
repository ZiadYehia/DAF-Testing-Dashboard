import { NextRequest, NextResponse } from 'next/server'
import { guardApp } from '@/lib/auth'
import { getSetting } from '@/lib/settings'
import { getModelsWithStatusAsync } from '@/lib/ai'
import { isFeatureEnabled } from '@/lib/ai-config'
import { getProject, applyPyArtifacts, applyTsArtifacts } from '@automation-hub/store'
import { reviseSpec, revisePySpec } from '@automation-hub/engine/codegen'
import { listPageFileContents, listTsPageFileContents } from '@automation-hub/lib/pom-index'

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
 * POST /api/[app]/automation/[project]/improve — revise the saved spec with AI.
 * Body: { instruction, language? }. Saves and returns the updated spec.
 * TS branch (language !== 'py'): applies the returned test + page-object appends
 * and responds { spec, tsPageFiles, touchedPages }. Py branch: unchanged,
 * { pySpec, pageFiles, touchedPages }.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ app: string; project: string }> },
) {
  const { app, project } = await params
  const guard = await guardApp(app, 'automation.edit')
  if (!guard.ok) return guard.response
  if (!(await isFeatureEnabled(app, 'automationHub'))) {
    return NextResponse.json({ error: 'AI is disabled for this app (Settings → AI & Models)' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const instruction = String(body?.instruction ?? '').trim()
  if (!instruction) return NextResponse.json({ error: 'An instruction is required' }, { status: 400 })
  const language = body?.language === 'py' ? 'py' : 'ts'

  const detail = await getProject(project)
  if (!detail) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  if (language === 'py' && !detail.pySpec) {
    return NextResponse.json({ error: 'No Python spec exists for this project yet' }, { status: 404 })
  }

  const picked = await pickModel(guard.access.user.id, typeof body?.model === 'string' ? body.model : undefined)
  const apiKey = picked?.provider === 'anthropic' ? (await getSetting(`user:${guard.access.user.id}`, 'ANTHROPIC_API_KEY')) ?? '' : ''
  if (!picked) {
    return NextResponse.json({ error: 'No AI model available — add a provider API key in Settings → AI & Models' }, { status: 400 })
  }

  try {
    if (language === 'py') {
      const targetApp = detail.app ?? app
      const pageFiles = listPageFileContents(targetApp)
      const artifacts = await revisePySpec({
        apiKey, modelId: picked.modelId, provider: picked.provider, currentTest: detail.pySpec as string, pageFiles, instruction, app,
        userId: guard.access.user.id,
      })
      const { touchedPages } = await applyPyArtifacts(project, artifacts)
      return NextResponse.json({
        pySpec: artifacts.test,
        pageFiles: listPageFileContents(targetApp),
        touchedPages,
      })
    }
    const targetApp = detail.app ?? app
    const pageFiles = listTsPageFileContents(targetApp)
    const artifacts = await reviseSpec({
      apiKey, modelId: picked.modelId, provider: picked.provider, currentSpec: detail.spec, pageFiles, instruction, app,
      userId: guard.access.user.id,
    })
    const { touchedPages } = await applyTsArtifacts(project, artifacts)
    return NextResponse.json({
      spec: artifacts.test,
      tsPageFiles: listTsPageFileContents(targetApp),
      touchedPages,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Failed to revise' }, { status: 500 })
  }
}
