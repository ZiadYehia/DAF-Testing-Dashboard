import { NextRequest, NextResponse } from 'next/server'
import { getScreenshotData } from '@/lib/features'
import { getApp } from '@/lib/apps'
import path from 'path'
import { requireAppPermission } from '@/lib/auth'

type Params = { params: Promise<{ app: string; name: string; file: string }> }

// GET /api/[app]/features/[name]/screenshots/[file] — serve screenshot image
export async function GET(_req: NextRequest, { params }: Params) {
  const { app, name, file } = await params
  try {
    await requireAppPermission(app, 'features.view')
  } catch (err: any) {
    return NextResponse.json({ error: 'Not found' }, { status: err.status ?? 404 })
  }
  if (!getApp(app)) return new NextResponse('App not found', { status: 404 })

  // Sanitize to prevent path traversal
  const safeFile = path.basename(file)
  const result = await getScreenshotData(app, name, safeFile)

  if (!result) {
    return new NextResponse('Screenshot not found', { status: 404 })
  }

  return new NextResponse(new Uint8Array(result.data), {
    headers: { 'Content-Type': result.mimeType },
  })
}
