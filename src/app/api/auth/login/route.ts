import { NextRequest, NextResponse } from 'next/server'
import { loginUser, createSession } from '@/lib/auth'
import { checkRateLimit, recordFailure, clearRateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const email: string = body?.email?.trim() ?? ''
  const password: string = body?.password ?? ''

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
  }

  // x-forwarded-for's first hop is correct behind the Caddy proxy. On a
  // bare deployment (no proxy) this falls back to a shared 'unknown' bucket
  // per-email, which is an acceptable degradation.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const rateKey = `login:${ip}:${String(email).toLowerCase()}`

  const rateStatus = checkRateLimit(rateKey)
  if (!rateStatus.allowed) {
    return NextResponse.json(
      { error: 'Too many login attempts. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(rateStatus.retryAfterSeconds) } },
    )
  }

  try {
    const user = await loginUser(email, password)
    if (!user) {
      recordFailure(rateKey)
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    clearRateLimit(rateKey)
    await createSession(user.id, user.role)

    return NextResponse.json({ user })
  } catch (err: any) {
    // DB-down (auth.ts's dbUnavailable, status 503) must surface as such, not a bare 500.
    return NextResponse.json({ error: err.message ?? 'Error' }, { status: err.status ?? 500 })
  }
}
