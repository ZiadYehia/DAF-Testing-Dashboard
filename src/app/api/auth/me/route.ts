import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

export async function GET() {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    return NextResponse.json({ user })
  } catch (err: any) {
    // DB-down (auth.ts's dbUnavailable, status 503) must surface as such, not a bare 500.
    return NextResponse.json({ error: err.message ?? 'Error' }, { status: err.status ?? 500 })
  }
}
