import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import {
  getBug,
  listAttachments,
  saveAttachment,
  deleteAttachment,
  attachmentMimeForName,
  MAX_ATTACHMENT_BYTES,
} from '@/lib/bugs'
import { guardApp } from '@/lib/auth'

type Params = { params: Promise<{ app: string; feature: string; slug: string }> }

// GET /api/[app]/bugs/[feature]/[slug]/attachments — list attachments
export async function GET(_req: NextRequest, { params }: Params) {
  const { app, feature, slug } = await params
  const guard = await guardApp(app, 'bugs.view')
  if (!guard.ok) return guard.response
  return NextResponse.json(await listAttachments(app, feature, slug))
}

// POST /api/[app]/bugs/[feature]/[slug]/attachments — upload attachments (field: "attachments")
export async function POST(req: NextRequest, { params }: Params) {
  const { app, feature, slug } = await params
  const guard = await guardApp(app, 'bugs.edit')
  if (!guard.ok) return guard.response

  const bug = await getBug(app, feature, slug)
  if (!bug) return NextResponse.json({ error: 'Bug not found' }, { status: 404 })

  // If the body exceeds the proxy buffer limit it is silently truncated, which
  // makes formData parsing throw. Treat that as "file too large".
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json(
      { error: 'Upload failed — file is too large (max 25 MB per file).' },
      { status: 413 }
    )
  }
  const files = formData.getAll('attachments') as File[]
  const uploaded: string[] = []

  for (const file of files) {
    // Sanitize filename — only allow safe characters
    const safeName = path.basename(file.name).replace(/[^a-zA-Z0-9._-]/g, '_')
    const mimeType = attachmentMimeForName(safeName)
    if (!mimeType) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.name}. Allowed: images (png, jpg, gif, webp) and video (mp4, webm, mov).` },
        { status: 415 }
      )
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      return NextResponse.json(
        { error: `${file.name} is too large (max 25 MB).` },
        { status: 413 }
      )
    }
    const buffer = Buffer.from(await file.arrayBuffer())
    await saveAttachment(app, feature, slug, safeName, mimeType, buffer)
    uploaded.push(safeName)
  }

  return NextResponse.json({ uploaded })
}

// DELETE /api/[app]/bugs/[feature]/[slug]/attachments — delete (body: { fileName })
export async function DELETE(req: NextRequest, { params }: Params) {
  const { app, feature, slug } = await params
  const guard = await guardApp(app, 'bugs.edit')
  if (!guard.ok) return guard.response
  const { fileName } = await req.json() as { fileName: string }
  const safeName = path.basename(fileName)
  const deleted = await deleteAttachment(app, feature, slug, safeName)
  return NextResponse.json({ deleted })
}
