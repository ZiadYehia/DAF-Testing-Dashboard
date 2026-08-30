import { NextRequest, NextResponse } from 'next/server'
import { guardApp } from '@/lib/auth'
import { readIntake, saveIntakeGroup, groupsForScope, intakeFileExists, IntakeConflictError, type IntakeScope } from '@/lib/intake'
import { appReadiness, moduleReadiness, featureReadiness } from '@/lib/readiness'
import type { IntakeValue } from '@/lib/intake-types'

type Params = { params: Promise<{ app: string }> }
type ScopeKind = 'app' | 'module' | 'feature'

function isScopeKind(x: unknown): x is ScopeKind {
  return x === 'app' || x === 'module' || x === 'feature'
}

/** Build the { app } | { app, module } | { app, feature } scope object from the request's scope+slug. */
function buildScope(app: string, kind: ScopeKind, slug: string | null): IntakeScope | null {
  if (kind === 'app') return { app }
  if (!slug) return null
  if (kind === 'module') return { app, module: slug }
  return { app, feature: slug }
}

async function readinessFor(app: string, kind: ScopeKind, slug: string | null) {
  if (kind === 'module' && slug) return moduleReadiness(app, slug)
  if (kind === 'feature' && slug) return featureReadiness(app, slug)
  return appReadiness(app)
}

export async function GET(req: NextRequest, { params }: Params) {
  const { app } = await params
  const scopeParam = req.nextUrl.searchParams.get('scope')
  const slug = req.nextUrl.searchParams.get('slug')

  if (!isScopeKind(scopeParam)) {
    return NextResponse.json({ error: 'scope must be one of: app, module, feature' }, { status: 400 })
  }

  // Mirrors how existing routes split view/edit gating: app/module profile
  // knowledge lives under Settings; feature answers live under Features.
  const permission = scopeParam === 'feature' ? 'features.view' : 'settings.view'
  const guard = await guardApp(app, permission)
  if (!guard.ok) return guard.response

  const scope = buildScope(app, scopeParam, slug)
  if (!scope) return NextResponse.json({ error: 'slug is required for module/feature scope' }, { status: 400 })

  const intake = await readIntake(scope)
  return NextResponse.json({
    groups: groupsForScope(scope),
    answers: intake.answers,
    hasIntake: await intakeFileExists(scope),
    readiness: await readinessFor(app, scopeParam, slug),
  })
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { app } = await params
  const body = (await req.json().catch(() => null)) as {
    scope?: string
    slug?: string
    groupId?: string
    answers?: Record<string, IntakeValue>
    force?: boolean
  } | null

  if (!body || !isScopeKind(body.scope) || !body.groupId || typeof body.answers !== 'object' || body.answers === null) {
    return NextResponse.json({ error: 'scope, groupId and answers are required' }, { status: 400 })
  }

  const permission = body.scope === 'feature' ? 'features.edit' : 'settings.edit'
  const guard = await guardApp(app, permission)
  if (!guard.ok) return guard.response

  const scope = buildScope(app, body.scope, body.slug ?? null)
  if (!scope) return NextResponse.json({ error: 'slug is required for module/feature scope' }, { status: 400 })

  try {
    await saveIntakeGroup(scope, body.groupId, body.answers, { force: body.force === true })
  } catch (err) {
    if (err instanceof IntakeConflictError) {
      return NextResponse.json({ conflict: true, file: err.file }, { status: 409 })
    }
    const status = (err as { status?: number })?.status ?? 500
    const message = err instanceof Error ? err.message : 'Failed to save intake group'
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ ok: true, readiness: await readinessFor(app, body.scope, body.slug ?? null) })
}
