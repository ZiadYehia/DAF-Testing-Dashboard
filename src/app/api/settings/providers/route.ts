import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requireAdmin } from '@/lib/auth'
import {
  getCustomProviders,
  saveCustomProviders,
  customProviderKeyName,
  getModelRegistry,
  saveModelRegistry,
  PROVIDER_ENV_KEY,
  type CustomProvider,
} from '@/lib/ai-config'

export const runtime = 'nodejs'

/** GET /api/settings/providers — user-added providers (with their key setting names). */
export async function GET(_req: NextRequest) {
  try {
    await requireAuth()
  } catch (err: any) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: err.status ?? 401 })
  }
  const providers = await getCustomProviders()
  return NextResponse.json({
    providers: providers.map((p) => ({ ...p, keyName: customProviderKeyName(p.id) })),
  })
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/

/** PUT /api/settings/providers — replace the custom provider list. Body: { providers }.
 *  Admin-only: providers are global configuration shared by every app. */
export async function PUT(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (err: any) {
    return NextResponse.json({ error: 'Forbidden' }, { status: err.status ?? 401 })
  }
  const body = await req.json().catch(() => ({}))
  const raw = Array.isArray(body?.providers) ? body.providers : null
  if (!raw) return NextResponse.json({ error: 'Body must be { providers: [...] }' }, { status: 400 })

  const seen = new Set<string>()
  const providers: CustomProvider[] = []
  for (const p of raw) {
    const id = String(p?.id ?? '').trim().toLowerCase()
    const label = String(p?.label ?? '').trim()
    const baseUrl = String(p?.baseUrl ?? '').trim().replace(/\/+$/, '')
    if (!SLUG_RE.test(id)) {
      return NextResponse.json({ error: `Invalid provider id "${id}" — use lowercase letters, digits, and dashes` }, { status: 400 })
    }
    if (id in PROVIDER_ENV_KEY) {
      return NextResponse.json({ error: `"${id}" is a built-in provider` }, { status: 400 })
    }
    if (seen.has(id)) {
      return NextResponse.json({ error: `Duplicate provider id "${id}"` }, { status: 400 })
    }
    if (!label) return NextResponse.json({ error: 'Provider label is required' }, { status: 400 })
    if (!/^https?:\/\//.test(baseUrl)) {
      return NextResponse.json({ error: `Base URL must start with http(s):// — got "${baseUrl}"` }, { status: 400 })
    }
    seen.add(id)
    providers.push({ id, label, baseUrl })
  }

  await saveCustomProviders(providers)

  // Prune registry models that referenced a provider which no longer exists.
  const validProviders = new Set([...Object.keys(PROVIDER_ENV_KEY), ...providers.map((p) => p.id)])
  const registry = await getModelRegistry()
  const keptModels = registry.custom.filter((m) => validProviders.has(m.provider))
  if (keptModels.length !== registry.custom.length) {
    const keptIds = new Set(keptModels.map((m) => m.id))
    await saveModelRegistry({
      custom: keptModels,
      disabled: registry.disabled.filter((id) => keptIds.has(id) || !registry.custom.some((m) => m.id === id)),
    })
  }
  return NextResponse.json({ ok: true })
}
