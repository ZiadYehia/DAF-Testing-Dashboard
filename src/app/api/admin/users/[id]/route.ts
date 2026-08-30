import { NextRequest, NextResponse } from 'next/server'
import { IsNull } from 'typeorm'
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
      const adminCount = await userRepo.count({ where: { role: 'admin', deletedAt: IsNull() } })
      if (adminCount <= 1) {
        return NextResponse.json({ error: 'Cannot delete the last remaining admin.' }, { status: 400 })
      }
    }
    await userRepo.update(userId, { deletedAt: new Date() })
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string }
    return NextResponse.json({ error: err.message ?? 'Error' }, { status: err.status ?? 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin()
    const { id } = await params
    const userId = parseInt(id, 10)
    if (isNaN(userId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

    const ds = await getDataSource()
    const userRepo = ds.getRepository<IUser>('User')
    const target = await userRepo.findOne({ where: { id: userId } })
    if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await req.json().catch(() => null)
    const updateObj: Partial<IUser> = {}

    if (body?.name !== undefined) {
      const name: string = String(body.name).trim()
      if (!name) return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 })
      updateObj.name = name
    }

    if (body?.email !== undefined) {
      const email: string = String(body.email).trim().toLowerCase()
      if (!email) return NextResponse.json({ error: 'email cannot be empty' }, { status: 400 })
      updateObj.email = email
    }

    if (body?.role !== undefined) {
      const role = body.role === 'admin' ? 'admin' : body.role === 'member' ? 'member' : null
      if (!role) return NextResponse.json({ error: "role must be 'admin' or 'member'" }, { status: 400 })
      if (role === 'member' && target.role === 'admin') {
        if (admin.id === userId) {
          return NextResponse.json({ error: 'Cannot change your own role.' }, { status: 400 })
        }
        const adminCount = await userRepo.count({ where: { role: 'admin', deletedAt: IsNull() } })
        if (adminCount <= 1) {
          return NextResponse.json({ error: 'Cannot demote the last remaining admin.' }, { status: 400 })
        }
      }
      updateObj.role = role
    }

    if (body?.restore === true) {
      updateObj.deletedAt = null
    } else if (body?.restore === false) {
      if (admin.id === userId) {
        return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
      }
      if (target.role === 'admin') {
        const adminCount = await userRepo.count({ where: { role: 'admin', deletedAt: IsNull() } })
        if (adminCount <= 1) {
          return NextResponse.json({ error: 'Cannot delete the last remaining admin.' }, { status: 400 })
        }
      }
      updateObj.deletedAt = new Date()
    }

    await userRepo.update(userId, updateObj)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string }
    if (String(err.message).includes('UQ_users_email') || String(err.message).includes('UNIQUE')) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
    }
    return NextResponse.json({ error: err.message ?? 'Error' }, { status: err.status ?? 500 })
  }
}
