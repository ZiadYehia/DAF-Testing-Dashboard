import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getEnabledApps } from '@/lib/apps'

// Client-facing list of active apps (sidebar switcher, wizards). Any signed-in user.
export async function GET() {
  try {
    await requireAuth()
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 401
    return NextResponse.json({ error: 'Unauthorized' }, { status })
  }
  return NextResponse.json(getEnabledApps())
}
