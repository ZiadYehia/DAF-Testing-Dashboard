import { NextRequest, NextResponse } from 'next/server'
import { requireAppMember } from '@/lib/auth'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ app: string }> }
) {
  const { app } = await params
  try {
    const access = await requireAppMember(app)
    return NextResponse.json({ role: access.appRole, permissions: Array.from(access.permissions) })
  } catch (err: any) {
    return NextResponse.json({ error: 'Not found' }, { status: err.status ?? 404 })
  }
}
