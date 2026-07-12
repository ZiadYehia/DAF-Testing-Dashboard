import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { getEnabledApps } from '@/lib/apps'
import { listModules, writeModule, scaffoldModuleRoutes, slugIsValid } from '@/lib/modules'
import type { ModuleManifest } from '@/lib/modules'

export async function GET() {
  try {
    await requireAdmin()
    const apps = getEnabledApps().map((a) => ({
      appSlug: a.slug,
      appName: a.name,
      appIcon: a.icon,
      modules: listModules(a.slug),
    }))
    return NextResponse.json({ apps })
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string }
    return NextResponse.json({ error: err.message ?? 'Error' }, { status: err.status ?? 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const body = await req.json().catch(() => null) as {
      appSlug?: string; slug?: string; name?: string; icon?: string
      order?: number; pathPrefix?: string; description?: string
    }

    const appSlug    = body?.appSlug?.trim() ?? ''
    const slug       = body?.slug?.trim().toLowerCase() ?? ''
    const name       = body?.name?.trim() ?? ''
    const icon       = body?.icon?.trim() ?? 'Layers'
    const order      = typeof body?.order === 'number' ? body.order : 99
    const pathPrefix = (body?.pathPrefix ?? slug).trim().toLowerCase()
    const description = body?.description?.trim() ?? ''

    if (!appSlug || !getEnabledApps().some((a) => a.slug === appSlug)) {
      return NextResponse.json({ error: 'Invalid or disabled app' }, { status: 400 })
    }
    if (!slug || !slugIsValid(slug)) {
      return NextResponse.json({ error: 'slug must be lowercase letters, numbers, and hyphens only' }, { status: 400 })
    }
    if (pathPrefix && !slugIsValid(pathPrefix)) {
      return NextResponse.json({ error: 'pathPrefix must be lowercase letters, numbers, and hyphens only' }, { status: 400 })
    }
    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const existing = listModules(appSlug)
    if (existing.some((m) => m.slug === slug)) {
      return NextResponse.json({ error: `Module "${slug}" already exists for ${appSlug}` }, { status: 409 })
    }
    if (pathPrefix === '' && existing.some((m) => m.pathPrefix === '')) {
      return NextResponse.json({ error: 'An app can only have one root module (pathPrefix: "")' }, { status: 409 })
    }
    if (pathPrefix && existing.some((m) => m.pathPrefix === pathPrefix)) {
      return NextResponse.json({ error: `Path prefix "${pathPrefix}" is already used by another module` }, { status: 409 })
    }

    const manifest: ModuleManifest = { slug, name, icon, order, pathPrefix, description }
    writeModule(appSlug, manifest)
    if (pathPrefix) scaffoldModuleRoutes(appSlug, slug, pathPrefix, name)

    return NextResponse.json({ ok: true, module: manifest }, { status: 201 })
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string }
    return NextResponse.json({ error: err.message ?? 'Error' }, { status: err.status ?? 500 })
  }
}
