import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { getAttachmentData } from '@/lib/bugs'
import { getApp } from '@/lib/apps'
import { requireAppPermission } from '@/lib/auth'

type Params = { params: Promise<{ app: string; feature: string; slug: string; file: string }> }

// GET /api/[app]/bugs/[feature]/[slug]/attachments/[file] — serve attachment (image or video)
export async function GET(_req: NextRequest, { params }: Params) {
  const { app, feature, slug, file } = await params
  try {
    await requireAppPermission(app, 'bugs.view')
  } catch (err: any) {
    return NextResponse.json({ error: 'Not found' }, { status: err.status ?? 404 })
  }
  if (!getApp(app)) return new NextResponse('App not found', { status: 404 })

  // Sanitize to prevent path traversal
  const safeFile = path.basename(file)
  const result = await getAttachmentData(app, feature, slug, safeFile)

  if (!result) {
    return new NextResponse('Attachment not found', { status: 404 })
  }

  return new NextResponse(new Uint8Array(result.data), {
    headers: {
      'Content-Type': result.mimeType,
      'Content-Disposition': `inline; filename="${safeFile}"`,
      // no-store so a deleted attachment can't keep serving from cache
      'Cache-Control': 'private, no-store',
    },
  })
}
