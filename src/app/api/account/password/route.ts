import { NextRequest, NextResponse } from 'next/server'
import { getSession, hashPassword, verifyPassword } from '@/lib/auth'
import { getDataSource } from '@/lib/db'
import type { IUser } from '@/lib/entities'

export async function POST(req: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const body = await req.json().catch(() => null)
    const currentPassword: string | undefined = body?.currentPassword
    const newPassword: string | undefined = body?.newPassword
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'currentPassword and newPassword are required' }, { status: 400 })
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    const ds = await getDataSource()
    const userRepo = ds.getRepository<IUser>('User')
    // getSession's user omits passwordHash — re-fetch the full row to verify against.
    const row = await userRepo.findOne({ where: { id: user.id } })
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const valid = await verifyPassword(currentPassword, row.passwordHash)
    if (!valid) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })

    const passwordHash = await hashPassword(newPassword)
    await userRepo.update(user.id, { passwordHash })
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string }
    return NextResponse.json({ error: err.message ?? 'Error' }, { status: err.status ?? 500 })
  }
}
