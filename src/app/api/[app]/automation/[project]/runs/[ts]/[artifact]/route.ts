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
  // API projects emit a request/response viewer plus its raw data and an importable
  // Postman collection of exactly the calls that ran (automation-hub/lib/eptts-api-log.ts).
  'api-log.html': 'text/html',
  'api-exchanges.json': 'application/json',
  'api-postman-collection.json': 'application/json',
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
    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Content-Length': String(data.length),
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    }
    // api-log.html is generated HTML served from our own origin, so lock it down: the
    // viewer needs only its inline <style>, never script or network access. Its content is
    // escaped at generation time, and this is the second layer.
    if (artifact === 'api-log.html') {
      headers['Content-Security-Policy'] =
        "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'; sandbox"
    }
    return new NextResponse(data as any, { headers })
  } catch {
    return NextResponse.json({ error: 'Artifact not found' }, { status: 404 })
  }
}
