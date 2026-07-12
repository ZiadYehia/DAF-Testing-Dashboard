import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { getDataSource } from '@/lib/db'
import { SettingEntity, ISetting } from '@/lib/entities'
import { getApp, updateApp, setAppEnabled } from '@/lib/apps'
import { AppConfig, APP_TYPES, appLogoKey } from '@/lib/app-types'

const MAX_LOGO_LEN = Math.ceil(2 * 1024 * 1024 * (4 / 3)) + 64

async function saveAppLogo(slug: string, dataUrl: string): Promise<void> {
  const ds = await getDataSource()
  const repo = ds.getRepository(SettingEntity)
  const key = appLogoKey(slug)
  const existing = await repo.findOne({ where: { scope: 'logo', key } })
  if (existing) {
    existing.value = dataUrl
    existing.updatedAt = new Date()
    await repo.save(existing)
  } else {
    await repo.save({ scope: 'logo', key, value: dataUrl, updatedAt: new Date() } as ISetting)
  }
}

type Params = { params: Promise<{ slug: string }> }

// Edit an app's name / logo / info / capabilities / enabled state.
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    await requireAdmin()
    const { slug } = await params
    if (!getApp(slug)) {
      return NextResponse.json({ error: 'App not found' }, { status: 404 })
    }

    const body = (await req.json().catch(() => null)) as
      | (Partial<AppConfig> & { logo?: string })
      | null
    if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

    const patch: Partial<Omit<AppConfig, 'slug'>> = {}
    if (typeof body.name === 'string') {
      if (!body.name.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
      patch.name = body.name.trim()
    }
    if (typeof body.description === 'string') patch.description = body.description.trim()
    if (typeof body.icon === 'string' && body.icon.trim()) patch.icon = body.icon.trim()
    if (typeof body.platform === 'string') patch.platform = body.platform.trim()
    if (APP_TYPES.includes(body.type as AppConfig['type'])) patch.type = body.type as AppConfig['type']
    if (typeof body.enabled === 'boolean') patch.enabled = body.enabled
    if (body.capabilities && typeof body.capabilities === 'object') {
      patch.capabilities = {
        testCaseWriter: !!body.capabilities.testCaseWriter,
        featureWizard: !!body.capabilities.featureWizard,
        moduleKnowledge: !!body.capabilities.moduleKnowledge,
      }
    }

    // Logo update (data URL). Empty string clears it.
    if (typeof body.logo === 'string') {
      const logo = body.logo.trim()
      if (logo && !logo.startsWith('data:image/')) {
        return NextResponse.json({ error: 'Logo must be an image' }, { status: 400 })
      }
      if (logo.length > MAX_LOGO_LEN) {
        return NextResponse.json({ error: 'Logo must be under 2 MB' }, { status: 400 })
      }
      try {
        await saveAppLogo(slug, logo)
      } catch {
        /* non-fatal */
      }
    }

    const updated = updateApp(slug, patch)
    return NextResponse.json({ ok: true, app: updated })
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string }
    return NextResponse.json({ error: err.message ?? 'Error' }, { status: err.status ?? 500 })
  }
}

// "Delete" = archive (disable). Data is preserved and the app can be restored
// via PUT { enabled: true }.
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await requireAdmin()
    const { slug } = await params
    if (!getApp(slug)) {
      return NextResponse.json({ error: 'App not found' }, { status: 404 })
    }
    const updated = setAppEnabled(slug, false)
    return NextResponse.json({ ok: true, app: updated })
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string }
    return NextResponse.json({ error: err.message ?? 'Error' }, { status: err.status ?? 500 })
  }
}
