import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { getEnabledApps } from '@/lib/apps'
import { getModule, writeModule, deleteModule, removeModuleRoutes, scaffoldModuleRoutes, slugIsValid } from '@/lib/modules'
import type { ModuleManifest } from '@/lib/modules'

type Params = { params: Promise<{ slug: string }> }

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    await requireAdmin()
    const { slug } = await params
    const appSlug = req.nextUrl.searchParams.get('app') ?? ''

    if (!appSlug || !getEnabledApps().some((a) => a.slug === appSlug)) {
      return NextResponse.json({ error: 'Invalid or disabled app' }, { status: 400 })
    }

    const existing = getModule(appSlug, slug)
    if (!existing) return NextResponse.json({ error: 'Module not found' }, { status: 404 })

    const body = await req.json().catch(() => null) as {
      name?: string; icon?: string; order?: number; pathPrefix?: string; description?: string
    }

    const name        = body?.name?.trim() || existing.name
    const icon        = body?.icon?.trim() || existing.icon
    const order       = typeof body?.order === 'number' ? body.order : existing.order
    const pathPrefix  = body?.pathPrefix !== undefined
      ? body.pathPrefix.trim().toLowerCase()
      : existing.pathPrefix
    const description = body?.description !== undefined ? body.description.trim() : (existing.description ?? '')

    if (pathPrefix && !slugIsValid(pathPrefix)) {
      return NextResponse.json({ error: 'pathPrefix must be lowercase letters, numbers, and hyphens only' }, { status: 400 })
    }

    const updated: ModuleManifest = { slug, name, icon, order, pathPrefix, description }
    writeModule(appSlug, updated)

    if (pathPrefix && pathPrefix !== existing.pathPrefix) {
      scaffoldModuleRoutes(appSlug, slug, pathPrefix, name)
    }

    return NextResponse.json({ ok: true, module: updated })
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string }
    return NextResponse.json({ error: err.message ?? 'Error' }, { status: err.status ?? 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    await requireAdmin()
    const { slug } = await params
    const appSlug = req.nextUrl.searchParams.get('app') ?? ''

    if (!appSlug || !getEnabledApps().some((a) => a.slug === appSlug)) {
      return NextResponse.json({ error: 'Invalid or disabled app' }, { status: 400 })
    }

    const existing = getModule(appSlug, slug)
    if (!existing) return NextResponse.json({ error: 'Module not found' }, { status: 404 })

    if (existing.pathPrefix === '') {
      return NextResponse.json(
        { error: 'Cannot delete the root module — it has no URL prefix and serves as the default view' },
        { status: 400 }
      )
    }

    removeModuleRoutes(existing.pathPrefix)
    deleteModule(appSlug, slug)

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string }
    return NextResponse.json({ error: err.message ?? 'Error' }, { status: err.status ?? 500 })
  }
}
