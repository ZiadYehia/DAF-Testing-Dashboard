import { NextRequest, NextResponse } from 'next/server'
import { guardApp } from '@/lib/auth'
import { listTsPageFileContents } from '@automation-hub/lib/pom-index'

export const runtime = 'nodejs'

/**
 * GET /api/[app]/automation/pages — this app's TS page-object files, for the
 * manual-create dialog's "starting page" picker. { pages: [{ path, className }] }.
 * Files whose class name can't be parsed are omitted.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ app: string }> },
) {
  const { app } = await params
  const guard = await guardApp(app, 'automation.view')
  if (!guard.ok) return guard.response

  const pages = listTsPageFileContents(app)
    .map((f: { path: string; content: string }) => ({
      path: f.path,
      className: /export class (\w+)/.exec(f.content)?.[1] ?? '',
    }))
    .filter((p: { path: string; className: string }) => p.className)

  return NextResponse.json({ pages })
}
