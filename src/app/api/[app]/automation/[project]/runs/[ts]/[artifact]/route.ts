import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { guardApp } from '@/lib/auth'
import { runDir } from '@automation-hub/store'

export const runtime = 'nodejs'

// Only these artifacts may be served, and only by exact name — no path traversal.
const ARTIFACTS: Record<string, string> = {
  'video.webm': 'video/webm',
  'video.mp4': 'video/mp4',
  'trace.zip': 'application/zip',
}
const TS_RE = /^[0-9T:\-.Z]+$/ // run-folder timestamps only

/** GET /api/[app]/automation/[project]/runs/[ts]/[artifact] — serve a run artifact. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ app: string; project: string; ts: string; artifact: string }> },
) {
  const { app, project, ts, artifact } = await params
  const guard = await guardApp(app, 'automation.view')
  if (!guard.ok) return guard.response

  const contentType = ARTIFACTS[artifact]
  if (!contentType || !TS_RE.test(ts)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const filePath = path.join(runDir(project, ts), artifact)
  try {
    const data = await fs.readFile(filePath)
    return new NextResponse(data as any, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(data.length),
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Artifact not found' }, { status: 404 })
  }
}
