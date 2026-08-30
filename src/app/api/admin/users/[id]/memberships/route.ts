import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { getDataSource } from '@/lib/db'
import type { IAppMembership } from '@/lib/entities'
import { filterPermissionKeys } from '@/lib/permissions'
import { getRoleDefinitions } from '@/lib/role-permissions-server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()
    const { id } = await params
    const userId = parseInt(id, 10)
    if (isNaN(userId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    const ds = await getDataSource()
    const memberships = await ds.getRepository<IAppMembership>('AppMembership').find({ where: { userId } })
    return NextResponse.json({ memberships })
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string }
    return NextResponse.json({ error: err.message ?? 'Error' }, { status: err.status ?? 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()
    const { id } = await params
    const userId = parseInt(id, 10)
    if (isNaN(userId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

    const body = await req.json().catch(() => null)
    const incoming: { appSlug: string; role: string; permissions?: string[] }[] = body?.memberships ?? []
    // Validate against the live role registry (built-ins + persisted custom
    // roles like "scrum") plus the special "custom" role — NOT a static list,
    // or a custom role would be silently dropped and its membership wiped.
    const roleDefs = await getRoleDefinitions()
    const validRoles = new Set<string>([...roleDefs.map(r => r.name), 'custom'])
    const valid = incoming.filter(
      m => typeof m.appSlug === 'string' && m.appSlug.length > 0 && validRoles.has(m.role)
    )

    const ds = await getDataSource()
    await ds.transaction(async txn => {
      const repo = txn.getRepository<IAppMembership>('AppMembership')
      await repo.delete({ userId })
      if (valid.length > 0) {
        await repo.insert(valid.map(m => ({
          userId,
          appSlug: m.appSlug,
          role: m.role,
          permissions: m.role === 'custom' ? JSON.stringify(filterPermissionKeys(m.permissions)) : null,
        })))
      }
    })

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string }
    return NextResponse.json({ error: err.message ?? 'Error' }, { status: err.status ?? 500 })
  }
}
