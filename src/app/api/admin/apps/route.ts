import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { getDataSource } from '@/lib/db'
import { SettingEntity, ISetting } from '@/lib/entities'
import { getAllApps, createApp } from '@/lib/apps'
import { scaffoldAppData } from '@/lib/app-scaffold'
import {
  AppConfig,
  APP_TYPES,
  appSlugIsValid,
  appLogoKey,
  defaultCapabilities,
} from '@/lib/app-types'

const MAX_LOGO_LEN = Math.ceil(2 * 1024 * 1024 * (4 / 3)) + 64

/** Save (or clear) an app logo in the settings table — same storage as /api/logo. */
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

export async function GET() {
  try {
    await requireAdmin()
    return NextResponse.json({ apps: getAllApps() })
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string }
    return NextResponse.json({ error: err.message ?? 'Error' }, { status: err.status ?? 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const body = (await req.json().catch(() => null)) as
      | (Partial<AppConfig> & {
          logo?: string
        })
      | null

    const slug = (body?.slug ?? '').trim().toLowerCase()
    const name = (body?.name ?? '').trim()
    if (!slug || !appSlugIsValid(slug)) {
      return NextResponse.json(
        { error: 'Slug must be lowercase letters, numbers and hyphens only' },
        { status: 400 }
      )
    }
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const type = APP_TYPES.includes(body?.type as AppConfig['type'])
      ? (body!.type as AppConfig['type'])
      : 'web'
    const caps = { ...defaultCapabilities(), ...(body?.capabilities ?? {}) }

    const logo = (body?.logo ?? '').trim()
    if (logo) {
      if (!logo.startsWith('data:image/')) {
        return NextResponse.json({ error: 'Logo must be an image' }, { status: 400 })
      }
      if (logo.length > MAX_LOGO_LEN) {
        return NextResponse.json({ error: 'Logo must be under 2 MB' }, { status: 400 })
      }
    }

    const config: AppConfig = {
      slug,
      name,
      description: (body?.description ?? '').trim(),
      icon: (body?.icon ?? '').trim() || '📦',
      enabled: true,
      type,
      platform: (body?.platform ?? '').trim(),
      capabilities: {
        testCaseWriter: !!caps.testCaseWriter,
        featureWizard: !!caps.featureWizard,
        moduleKnowledge: !!caps.moduleKnowledge,
      },
    }

    createApp(config) // throws 409 if slug taken

    // Scaffold data folders — knowledge docs are compiled later from intake.
    scaffoldAppData(slug)

    if (logo) {
      try {
        await saveAppLogo(slug, logo)
      } catch {
        /* logo is non-fatal — app + data already created */
      }
    }

    return NextResponse.json({ ok: true, app: config }, { status: 201 })
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string }
    return NextResponse.json({ error: err.message ?? 'Error' }, { status: err.status ?? 500 })
  }
}
