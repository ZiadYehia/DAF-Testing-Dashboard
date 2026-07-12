import { NextRequest, NextResponse } from 'next/server'
import { listFeatures, saveScreenshot, deleteScreenshot } from '@/lib/features'
import path from 'path'
import { guardApp } from '@/lib/auth'

type Params = { params: Promise<{ app: string; name: string }> }

// GET /api/[app]/features/[name]/screenshots — list screenshots
export async function GET(_req: NextRequest, { params }: Params) {
  const { app, name } = await params
  const guard = await guardApp(app, 'features.view')
  if (!guard.ok) return guard.response
  const features = await listFeatures(app)
  const feat = features.find((f) => f.name === name)
  if (!feat) return NextResponse.json([])
  return NextResponse.json({ screenshotCount: feat.screenshotCount })
}

// POST /api/[app]/features/[name]/screenshots — upload screenshots
export async function POST(req: NextRequest, { params }: Params) {
  const { app, name } = await params
  const guard = await guardApp(app, 'features.edit')
  if (!guard.ok) return guard.response

  const formData = await req.formData()
  const files = formData.getAll('screenshots') as File[]
  const uploaded: string[] = []

  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer())
    // Sanitize filename — only allow safe characters
    const safeName = path.basename(file.name).replace(/[^a-zA-Z0-9._-]/g, '_')
    await saveScreenshot(app, name, safeName, buffer)
    uploaded.push(safeName)
  }

  return NextResponse.json({ uploaded })
}

// DELETE /api/[app]/features/[name]/screenshots — delete (body: { fileName })
export async function DELETE(req: NextRequest, { params }: Params) {
  const { app, name } = await params
  const guard = await guardApp(app, 'features.edit')
  if (!guard.ok) return guard.response
  const { fileName } = await req.json() as { fileName: string }
  const safeName = path.basename(fileName)
  const deleted = await deleteScreenshot(app, name, safeName)
  return NextResponse.json({ deleted })
}
