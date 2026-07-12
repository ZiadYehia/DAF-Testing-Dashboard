import { NextRequest, NextResponse } from 'next/server'
import { listFeatures, createFeature, saveFeatureMetadata } from '@/lib/features'
import { guardApp } from '@/lib/auth'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ app: string }> }
) {
  const { app } = await params
  const guard = await guardApp(app, 'features.view')
  if (!guard.ok) return guard.response
  const moduleParam = req.nextUrl.searchParams.get('module')
  // undefined = all features, string = features in that module
  const module = moduleParam === null ? undefined : moduleParam
  const includeArchivedParam = req.nextUrl.searchParams.get('includeArchived')
  const includeArchived = includeArchivedParam === '1' || includeArchivedParam === 'true'
  const features = await listFeatures(app, module, { includeArchived })
  return NextResponse.json(features)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ app: string }> }
) {
  const { app } = await params
  const guard = await guardApp(app, 'features.create')
  if (!guard.ok) return guard.response
  const body = await req.json().catch(() => ({}))
  const { name, storyKey, module } = body as { name: string; storyKey?: string; module?: string | null }
  if (!name || !/^[a-z0-9-]+$/.test(name)) {
    return NextResponse.json(
      { error: 'Invalid feature name. Use lowercase letters, numbers, and hyphens.' },
      { status: 400 }
    )
  }
  await createFeature(app, name, module ?? null)
  if (storyKey?.trim()) {
    await saveFeatureMetadata(app, name, { storyKey: storyKey.trim() })
  }
  return NextResponse.json({ name })
}
