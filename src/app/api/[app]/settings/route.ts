import { NextRequest, NextResponse } from 'next/server'
import {
  APP_DEFAULT_KEYS,
  seedAppSettings,
  getSettingsForScope,
  setSetting,
} from '@/lib/settings'
import { guardApp } from '@/lib/auth'

type Params = { params: Promise<{ app: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { app } = await params
  const guard = await guardApp(app, 'settings.view')
  if (!guard.ok) return guard.response

  // seedAppSettings is best-effort — errors are swallowed inside the function
  await seedAppSettings(app)
  // getSettingsForScope always returns data (falls back to hardcoded defaults if DB unavailable)
  const values = await getSettingsForScope(app)
  return NextResponse.json(values)
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { app } = await params
  const guard = await guardApp(app, 'settings.edit')
  if (!guard.ok) return guard.response

  try {
    const body = (await req.json()) as { key: string; value: string }
    const { key, value } = body

    if (!key || !(APP_DEFAULT_KEYS as readonly string[]).includes(key)) {
      return NextResponse.json({ error: `Unknown key: ${key}` }, { status: 400 })
    }

    await setSetting(app, key, value ?? '')
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
