import { NextRequest, NextResponse } from 'next/server'
import { guardApp } from '@/lib/auth'
import { getApp } from '@/lib/apps'
import {
  getEnvironment, updateEnvironment, deleteEnvironment, activateEnvironment, validateVariables,
} from '@/lib/environments'

export const runtime = 'nodejs'

/**
 * GET    /api/[app]/environments/[id]        — one environment WITH its variable values
 * PATCH  /api/[app]/environments/[id]        — rename, re-describe, or replace variables
 * POST   /api/[app]/environments/[id]        — { activate: true } to switch to it
 * DELETE /api/[app]/environments/[id]        — remove it (never the active one)
 *
 * GET returns real values, not just names. That is the point of the screen: someone about to
 * switch targets needs to see which host and which credentials they are switching to, and a
 * masked value would make the comparison impossible. These are the team's own test
 * credentials, and nothing here is written to the committed `data/` tree.
 */

async function ctx(app: string, permission: 'automation.view' | 'automation.edit') {
  const guard = await guardApp(app, permission)
  if (!guard.ok) return { ok: false as const, response: guard.response }
  if (!(await getApp(app))) {
    return { ok: false as const, response: NextResponse.json({ error: 'App not found' }, { status: 404 }) }
  }
  return { ok: true as const }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ app: string; id: string }> },
) {
  const { app, id } = await params
  const gate = await ctx(app, 'automation.view')
  if (!gate.ok) return gate.response

  const env = await getEnvironment(app, Number(id))
  if (!env) return NextResponse.json({ error: 'Environment not found' }, { status: 404 })
  return NextResponse.json(env)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ app: string; id: string }> },
) {
  const { app, id } = await params
  const gate = await ctx(app, 'automation.edit')
  if (!gate.ok) return gate.response

  let body: { name?: string; description?: string; variables?: Record<string, string> }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400 })
  }

  if (body.variables) {
    const problems = validateVariables(body.variables)
    if (problems.length) return NextResponse.json({ error: problems.join(' ') }, { status: 400 })
  }

  try {
    const updated = await updateEnvironment(app, Number(id), body)
    if (!updated) return NextResponse.json({ error: 'Environment not found' }, { status: 404 })
    return NextResponse.json(updated)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not update the environment.' },
      { status: 400 },
    )
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ app: string; id: string }> },
) {
  const { app, id } = await params
  const gate = await ctx(app, 'automation.edit')
  if (!gate.ok) return gate.response

  let body: { activate?: boolean } = {}
  try { body = await req.json() } catch { /* an empty body means activate */ }
  if (body.activate === false) {
    return NextResponse.json(
      { error: 'Deactivating directly would leave the app with no target. Activate another instead.' },
      { status: 400 },
    )
  }

  const ok = await activateEnvironment(app, Number(id))
  if (!ok) return NextResponse.json({ error: 'Environment not found' }, { status: 404 })
  return NextResponse.json(await getEnvironment(app, Number(id)))
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ app: string; id: string }> },
) {
  const { app, id } = await params
  const gate = await ctx(app, 'automation.edit')
  if (!gate.ok) return gate.response

  try {
    const ok = await deleteEnvironment(app, Number(id))
    if (!ok) return NextResponse.json({ error: 'Environment not found' }, { status: 404 })
    return NextResponse.json({ deleted: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not delete the environment.' },
      { status: 400 },
    )
  }
}
