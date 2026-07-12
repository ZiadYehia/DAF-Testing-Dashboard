import { NextRequest, NextResponse } from 'next/server'
import { guardApp } from '@/lib/auth'
import type { PermissionKey } from '@/lib/permissions'
import {
  getProject, saveSpec, savePyTest, savePageFile, saveTsPageFile,
  setTags, setFolder, setLinkedTestcase, deleteProject,
} from '@automation-hub/store'
import { isPythonEnabled, listPageFileContents, listTsPageFileContents, listFrameworkFileContents } from '@automation-hub/lib/pom-index'

export const runtime = 'nodejs'

async function guard(app: string, permission: PermissionKey): Promise<NextResponse | null> {
  const result = await guardApp(app, permission)
  return result.ok ? null : result.response
}

/** GET /api/[app]/automation/[project] — full detail (meta + spec source). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ app: string; project: string }> },
) {
  const { app, project } = await params
  const blocked = await guard(app, 'automation.view')
  if (blocked) return blocked

  const detail = await getProject(project)
  if (!detail) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  const pythonEnabled = isPythonEnabled()
  const targetApp = detail.app ?? app
  const pageFiles = pythonEnabled ? listPageFileContents(targetApp) : undefined
  const tsPageFiles = listTsPageFileContents(targetApp)
  const frameworkFiles = listFrameworkFileContents()
  return NextResponse.json({
    ...detail,
    pythonEnabled,
    tsPageFiles,
    frameworkFiles,
    ...(pageFiles ? { pageFiles } : {}),
  })
}

/**
 * PUT /api/[app]/automation/[project] — save edits. Any combination of:
 *   { spec?: string, pySpec?: string, tags?: string[], folder?: string | null,
 *     linkedTestcase?: { feature, testcaseId } | null,
 *     pageFile?: { path: string, content: string },
 *     tsPageFile?: { path: string, content: string } }
 * linkedTestcase is completed with the route's app; null unlinks. pageFile.path is
 * relative to automation-hub/python/ (e.g. "pages/<app>/login_page.py") and must
 * already exist — 400 on an invalid/unknown path. tsPageFile.path is relative to
 * automation-hub/ (e.g. "pages/<app>/item-create.page.ts") and, symmetrically,
 * must already exist — 400 on an invalid/unknown path.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ app: string; project: string }> },
) {
  const { app, project } = await params
  const blocked = await guard(app, 'automation.edit')
  if (blocked) return blocked

  const body = await req.json().catch(() => ({}))
  const hasSpec = typeof body?.spec === 'string'
  const hasPySpec = typeof body?.pySpec === 'string'
  const hasTags = Array.isArray(body?.tags) && body.tags.every((t: unknown) => typeof t === 'string')
  const hasFolder = 'folder' in body && (typeof body.folder === 'string' || body.folder === null)
  const hasLink =
    'linkedTestcase' in body &&
    (body.linkedTestcase === null ||
      (typeof body.linkedTestcase?.feature === 'string' && typeof body.linkedTestcase?.testcaseId === 'string'))
  const hasPageFile =
    typeof body?.pageFile?.path === 'string' && typeof body?.pageFile?.content === 'string'
  const hasTsPageFile =
    typeof body?.tsPageFile?.path === 'string' && typeof body?.tsPageFile?.content === 'string'
  if (!hasSpec && !hasPySpec && !hasTags && !hasFolder && !hasLink && !hasPageFile && !hasTsPageFile) {
    return NextResponse.json(
      { error: 'Provide spec, pySpec, tags, folder, linkedTestcase, pageFile, and/or tsPageFile' },
      { status: 400 },
    )
  }
  if (hasPageFile) {
    try {
      await savePageFile(body.pageFile.path, body.pageFile.content)
    } catch (err: any) {
      return NextResponse.json({ error: err.message ?? 'Invalid page file' }, { status: 400 })
    }
  }
  if (hasTsPageFile) {
    try {
      await saveTsPageFile(body.tsPageFile.path, body.tsPageFile.content)
    } catch (err: any) {
      return NextResponse.json({ error: err.message ?? 'Invalid page file' }, { status: 400 })
    }
  }
  try {
    if (hasSpec) await saveSpec(project, body.spec)
    if (hasPySpec) await savePyTest(project, body.pySpec)
    if (hasTags) await setTags(project, body.tags)
    if (hasFolder) await setFolder(project, body.folder)
    if (hasLink) {
      await setLinkedTestcase(
        project,
        body.linkedTestcase === null
          ? null
          : { app, feature: body.linkedTestcase.feature, testcaseId: body.linkedTestcase.testcaseId },
      )
    }
    const detail = await getProject(project)
    return NextResponse.json({ ok: true, meta: detail })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Save failed' }, { status: 404 })
  }
}

/** DELETE /api/[app]/automation/[project] — remove the project and its runs. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ app: string; project: string }> },
) {
  const { app, project } = await params
  const blocked = await guard(app, 'automation.edit')
  if (blocked) return blocked

  await deleteProject(project)
  return NextResponse.json({ ok: true })
}
