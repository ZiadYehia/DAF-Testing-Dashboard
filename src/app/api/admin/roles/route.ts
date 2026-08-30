import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { getRoleDefinitions, saveRoleDefinitions } from '@/lib/role-permissions-server'

export async function GET() {
  try {
    await requireAdmin()
    return NextResponse.json({ roles: await getRoleDefinitions() })
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string }
    return NextResponse.json({ error: err.message ?? 'Error' }, { status: err.status ?? 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    await requireAdmin()
    const body = await req.json().catch(() => null)
    const roles = body?.roles

    if (!Array.isArray(roles)) {
      return NextResponse.json({ error: 'roles must be an array' }, { status: 400 })
    }

    await saveRoleDefinitions(roles)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string }
    return NextResponse.json({ error: err.message ?? 'Error' }, { status: err.status ?? 500 })
  }
}
