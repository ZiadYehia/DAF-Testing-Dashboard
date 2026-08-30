import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, generatePassword, hashPassword } from '@/lib/auth'
import { getDataSource } from '@/lib/db'
import type { IUser } from '@/lib/entities'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()
    const { id } = await params
    const userId = parseInt(id, 10)
    if (isNaN(userId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

    const ds = await getDataSource()
    const userRepo = ds.getRepository<IUser>('User')
    const target = await userRepo.findOne({ where: { id: userId } })
    if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const password = generatePassword()
    const passwordHash = await hashPassword(password)
    await userRepo.update(userId, { passwordHash })
    await ds.getRepository('Session').delete({ userId })

    return NextResponse.json({ password })
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string }
    return NextResponse.json({ error: err.message ?? 'Error' }, { status: err.status ?? 500 })
  }
}
