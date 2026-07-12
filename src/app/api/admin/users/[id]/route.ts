import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { getDataSource } from '@/lib/db'
import type { IUser } from '@/lib/entities'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin()
    const { id } = await params
    const userId = parseInt(id, 10)
    if (isNaN(userId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    if (admin.id === userId) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
    }
    const ds = await getDataSource()
    const userRepo = ds.getRepository<IUser>('User')
    const target = await userRepo.findOne({ where: { id: userId } })
    if (target?.role === 'admin') {
      const adminCount = await userRepo.count({ where: { role: 'admin' } })
      if (adminCount <= 1) {
        return NextResponse.json({ error: 'Cannot delete the last remaining admin.' }, { status: 400 })
      }
    }
    await userRepo.delete(userId)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string }
    return NextResponse.json({ error: err.message ?? 'Error' }, { status: err.status ?? 500 })
  }
}
