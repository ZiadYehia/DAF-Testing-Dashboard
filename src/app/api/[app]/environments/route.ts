import { NextRequest, NextResponse } from 'next/server'
import { guardApp } from '@/lib/auth'
import { getApp } from '@/lib/apps'
import { listEnvironments, createEnvironment, validateVariables } from '@/lib/environments'

export const runtime = 'nodejs'

/**
 * GET  /api/[app]/environments — every run target for this app.
 * POST /api/[app]/environments — create one, optionally activating it.
 *
 * Applies to every app type. A web app switches base URL and dashboard logins; an API app
 * switches service URLs and keys; a mobile app switches the backend its build talks to. The
 * shape is the same, so the feature is not special-cased per type.
 *
 * 'automation.edit' to create, 'automation.view' to read: defining where the suite points is
 * an authoring decision, and seeing which environment is live is not.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ app: string }> }) {
  const { app } = await params
  const guard = await guardApp(app, 'automation.view')
  if (!guard.ok) return guard.response
  if (!(await getApp(app))) return NextResponse.json({ error: 'App not found' }, { status: 404 })

  return NextResponse.json(await listEnvironments(app))
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ app: string }> }) {
  const { app } = await params
  const guard = await guardApp(app, 'automation.edit')
  if (!guard.ok) return guard.response
  if (!(await getApp(app))) return NextResponse.json({ error: 'App not found' }, { status: 404 })

  let body: { name?: string; description?: string; variables?: Record<string, string>; activate?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400 })
  }

  const problems = validateVariables(body.variables ?? {})
  if (problems.length) return NextResponse.json({ error: problems.join(' ') }, { status: 400 })

  try {
    return NextResponse.json(await createEnvironment(app, {
      name: body.name ?? '',
      description: body.description,
      variables: body.variables,
      activate: body.activate,
    }))
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not create the environment.' },
      { status: 400 },
    )
  }
}
