import { NextRequest, NextResponse } from 'next/server'
import { listModules } from '@/lib/modules'
import { guardAppMember } from '@/lib/auth'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ app: string }> }
) {
  const { app } = await params
  const guard = await guardAppMember(app)
  if (!guard.ok) return guard.response

  const modules = listModules(app)
  return NextResponse.json(modules)
}
