import { NextRequest, NextResponse } from 'next/server'
import { guardApp } from '@/lib/auth'
import { getProject, applyPyArtifacts } from '@automation-hub/store'
import { translateSpecToPython } from '@automation-hub/engine/codegen'
import { isPythonEnabled, listPageFileContents } from '@automation-hub/lib/pom-index'

export const runtime = 'nodejs'
export const maxDuration = 120

/**
 * POST /api/[app]/automation/[project]/translate — translate the saved TS spec into
 * an equivalent Python test (python/tests/<app>/test_<slug>.py), appending any new
 * page-object methods the model needs onto python/pages/<app>/*.py. No body required.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ app: string; project: string }> },
) {
  const { app, project } = await params
  const guard = await guardApp(app, 'automation.edit')
  if (!guard.ok) return guard.response

  if (!isPythonEnabled()) {
    return NextResponse.json(
      { error: 'Python generation disabled: set AUTOTEST_FRAMEWORK_ROOT in automation-hub/.env' },
      { status: 400 },
    )
  }

  const detail = await getProject(project)
  if (!detail) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  if (!detail.spec) {
    return NextResponse.json({ error: 'No TypeScript spec exists for this project yet' }, { status: 400 })
  }

  try {
    const targetApp = detail.app ?? app
    const artifacts = await translateSpecToPython(detail.spec, targetApp)
    const { touchedPages } = await applyPyArtifacts(project, artifacts)
    return NextResponse.json({
      pySpec: artifacts.test,
      pageFiles: listPageFileContents(targetApp),
      touchedPages,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Failed to translate' }, { status: 500 })
  }
}
