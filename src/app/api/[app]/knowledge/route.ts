import { NextRequest, NextResponse } from 'next/server'
import { listKnowledgeFiles } from '@/lib/knowledge'
import { guardApp } from '@/lib/auth'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ app: string }> }
) {
  const { app } = await params
  const guard = await guardApp(app, 'knowledge.view')
  if (!guard.ok) return guard.response

  const moduleParam = req.nextUrl.searchParams.get('module')
  const files = listKnowledgeFiles(app, moduleParam ?? null)
  return NextResponse.json(files)
}
