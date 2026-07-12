import { NextRequest, NextResponse } from 'next/server'
import { loginUser, createSession } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const email: string = body?.email?.trim() ?? ''
  const password: string = body?.password ?? ''

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
  }

  try {
    const user = await loginUser(email, password)
    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    await createSession(user.id, user.role)

    return NextResponse.json({ user })
  } catch (err: any) {
    // DB-down (auth.ts's dbUnavailable, status 503) must surface as such, not a bare 500.
    return NextResponse.json({ error: err.message ?? 'Error' }, { status: err.status ?? 500 })
  }
}
