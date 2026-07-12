import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getModelsWithStatusAsync } from '@/lib/ai'

export async function GET(_req: NextRequest) {
  try {
    await requireAuth()
  } catch (err: any) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: err.status ?? 401 })
  }
  return NextResponse.json(await getModelsWithStatusAsync())
}
