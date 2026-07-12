import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import {
  GLOBAL_KEYS,
  seedGlobalSettings,
  getSettingsForScope,
  setSetting,
  isSecretKey,
  maskSecretValue,
  MASK_PREFIX,
} from '@/lib/settings'

/** Keys of user-added AI providers (see customProviderKeyName in ai-config). */
const CUSTOM_PROVIDER_KEY_RE = /^AI_PROVIDER_KEY_[A-Z0-9_]+$/

/** Global settings include raw secrets (API keys, Jira tokens/PAT) — admin only. */
export async function GET(_req: NextRequest) {
  try {
    await requireAdmin()
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string }
    return NextResponse.json({ error: err.message ?? 'Error' }, { status: err.status ?? 500 })
  }
  // seedGlobalSettings is best-effort — errors are swallowed inside the function
  await seedGlobalSettings()
  // getSettingsForScope always returns data (falls back to env vars if DB unavailable)
  const values = await getSettingsForScope('global')
  // Mask secret values before they leave the server — raw values are for server-side callers only.
  const masked: Record<string, string> = {}
  for (const [key, value] of Object.entries(values)) {
    masked[key] = isSecretKey(key) ? maskSecretValue(value) : value
  }
  return NextResponse.json(masked)
}

export async function PUT(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string }
    return NextResponse.json({ error: err.message ?? 'Error' }, { status: err.status ?? 500 })
  }
  try {
    const body = (await req.json()) as { key: string; value: string }
    const { key, value } = body

    const known =
      !!key && ((GLOBAL_KEYS as readonly string[]).includes(key) || CUSTOM_PROVIDER_KEY_RE.test(key))
    if (!known) {
      return NextResponse.json({ error: `Unknown key: ${key}` }, { status: 400 })
    }
    // A masked value (from a GET response) must never be written back over the real one.
    if (typeof value === 'string' && value.startsWith(MASK_PREFIX)) {
      return NextResponse.json(
        { error: 'Masked value — enter the full key to update' },
        { status: 400 }
      )
    }

    await setSetting('global', key, value ?? '')
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
