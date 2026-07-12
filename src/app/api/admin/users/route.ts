import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, hashPassword } from '@/lib/auth'
import { getDataSource } from '@/lib/db'
import type { IUser, IAppMembership } from '@/lib/entities'

export async function GET() {
  try {
    await requireAdmin()
    const ds = await getDataSource()
    const [users, memberships] = await Promise.all([
      ds.getRepository<IUser>('User').find({ order: { createdAt: 'ASC' } }),
      ds.getRepository<IAppMembership>('AppMembership').find(),
    ])
    return NextResponse.json({
      users: users.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        createdAt: u.createdAt,
        memberships: memberships.filter(m => m.userId === u.id),
      })),
    })
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string }
    return NextResponse.json({ error: err.message ?? 'Error' }, { status: err.status ?? 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const body = await req.json().catch(() => null)
    const email: string = body?.email?.trim()?.toLowerCase() ?? ''
    const name: string = body?.name?.trim() ?? ''
    const password: string = body?.password ?? ''
    const role = body?.role === 'admin' ? 'admin' : 'member'

    if (!email || !name || !password) {
      return NextResponse.json({ error: 'email, name, and password are required' }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    const passwordHash = await hashPassword(password)
    const ds = await getDataSource()
    const result = await ds.getRepository<IUser>('User').insert({ email, name, passwordHash, role })
    return NextResponse.json({ id: result.identifiers[0].id }, { status: 201 })
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string }
    if (String(err.message).includes('UQ_users_email') || String(err.message).includes('UNIQUE')) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
    }
    return NextResponse.json({ error: err.message ?? 'Error' }, { status: err.status ?? 500 })
  }
}
