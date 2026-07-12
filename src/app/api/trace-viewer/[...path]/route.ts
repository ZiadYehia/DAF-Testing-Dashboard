import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

export const runtime = 'nodejs'

// Plain path built with path.join — NOT require.resolve. Turbopack rewrites
// require.resolve() results inside bundled route handlers to a path that
// doesn't actually contain the files, breaking runtime file access. See the
// same convention/comment at automation-hub/engine/runner.ts:106-109.
const TRACE_VIEWER_DIR = path.join(process.cwd(), 'node_modules', 'playwright-core', 'lib', 'vite', 'traceViewer')

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.json': 'application/json',
}

/**
 * GET /api/trace-viewer/[...path] — serve Playwright's self-contained trace-viewer
 * bundle so traces can be inspected in-app without downloading trace.zip. No auth
 * guard: this serves inert library assets with zero project data. The actual
 * trace.zip fetch still goes through the existing guarded artifact route.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path: segments } = await params
  const relPath = segments && segments.length > 0 ? segments.join('/') : 'index.html'

  const resolved = path.join(TRACE_VIEWER_DIR, relPath)
  if (!resolved.startsWith(TRACE_VIEWER_DIR)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const ext = path.extname(resolved).toLowerCase()
  const contentType = CONTENT_TYPES[ext] ?? 'application/octet-stream'
  const cacheControl = ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable'

  try {
    const data = await fs.readFile(resolved)
    return new NextResponse(data as any, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(data.length),
        'Cache-Control': cacheControl,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
