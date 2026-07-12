import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getModelsWithStatusAsync } from '@/lib/ai'
import { getModelRegistry, saveModelRegistry, getCustomProviders, providerKeyName, PROVIDER_ENV_KEY } from '@/lib/ai-config'

export const runtime = 'nodejs'

/** GET /api/settings/models — merged model list (with status) + the raw registry. */
export async function GET(_req: NextRequest) {
  try {
    await requireAuth()
  } catch (err: any) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: err.status ?? 401 })
  }
  const [models, registry] = await Promise.all([getModelsWithStatusAsync(), getModelRegistry()])
  return NextResponse.json({ models, registry })
}

/** PUT /api/settings/models — save the registry. Body: { disabled, custom }. */
export async function PUT(req: NextRequest) {
  try {
    await requireAuth()
  } catch (err: any) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: err.status ?? 401 })
  }
  const body = await req.json().catch(() => ({}))
  const disabled: string[] = Array.isArray(body?.disabled) ? body.disabled.map(String) : []

  // Normalise custom models: require id/name and a known provider (built-in or
  // user-added); derive the key setting name from the provider.
  const customProviderIds = new Set((await getCustomProviders()).map((p) => p.id))
  const custom = (Array.isArray(body?.custom) ? body.custom : [])
    .filter((m: any) => m?.id && m?.name && (m?.provider in PROVIDER_ENV_KEY || customProviderIds.has(m?.provider)))
    .map((m: any) => ({
      id: String(m.id),
      name: String(m.name),
      provider: String(m.provider),
      requiredEnvKey: providerKeyName(String(m.provider)),
      supportsVision: !!m.supportsVision,
      description: String(m.description ?? 'Custom model'),
    }))

  await saveModelRegistry({ disabled, custom })
  return NextResponse.json({ ok: true })
}
