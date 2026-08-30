import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getDataSource } from '@/lib/db'
import type { IUser } from '@/lib/entities'

export async function PATCH(req: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

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

    const ds = await getDataSource()
    await ds.getRepository<IUser>('User').update(user.id, updateObj)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string }
    if (String(err.message).includes('UQ_users_email') || String(err.message).includes('UNIQUE')) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
    }
    return NextResponse.json({ error: err.message ?? 'Error' }, { status: err.status ?? 500 })
  }
}
