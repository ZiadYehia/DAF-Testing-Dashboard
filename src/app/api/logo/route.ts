import { NextRequest, NextResponse } from 'next/server'
import { getDataSource } from '@/lib/db'
import { SettingEntity, ISetting } from '@/lib/entities'
import { requireAuth } from '@/lib/auth'

const LOGO_SCOPE = 'logo'
const KEY_RE = /^dashboard$|^app_[a-z0-9][a-z0-9-]*$|^module_[a-z0-9][a-z0-9-]*_[a-z0-9][a-z0-9-]*$/
// 2 MB → base64 is ~4/3× larger, add small headroom for the data: prefix
const MAX_LEN = Math.ceil(2 * 1024 * 1024 * (4 / 3)) + 64

export async function GET() {
  try {
    const ds = await getDataSource()
    const rows = await ds.getRepository(SettingEntity).find({ where: { scope: LOGO_SCOPE } })
    const result: Record<string, string> = {}
    for (const row of rows) {
      if (row.value) result[row.key] = row.value
    }
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({})
  }
}

export async function PUT(req: NextRequest) {
  try {
    await requireAuth()
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 401
    return NextResponse.json({ error: 'Unauthorized' }, { status })
  }

  try {
    const body = (await req.json()) as { key: string; value?: string }
    const { key, value = '' } = body

    if (!key || !KEY_RE.test(key)) {
      return NextResponse.json({ error: 'Invalid key' }, { status: 400 })
    }
    if (value && !value.startsWith('data:image/')) {
      return NextResponse.json({ error: 'Value must be an image data URL' }, { status: 400 })
    }
    if (value.length > MAX_LEN) {
      return NextResponse.json({ error: 'Logo must be under 2 MB' }, { status: 400 })
    }

    const ds = await getDataSource()
    const repo = ds.getRepository(SettingEntity)
    const existing = await repo.findOne({ where: { scope: LOGO_SCOPE, key } })
    if (existing) {
      existing.value = value
      existing.updatedAt = new Date()
      await repo.save(existing)
    } else {
      await repo.save({ scope: LOGO_SCOPE, key, value, updatedAt: new Date() } as ISetting)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
