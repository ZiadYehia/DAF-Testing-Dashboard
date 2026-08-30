import { NextRequest, NextResponse } from 'next/server'
import { getRequirements, listFeatures, type NewRequirementRow } from '@/lib/features'
import { breakStoryIntoFeatures, type ProposedFR } from '@/lib/ai'
import { loadLocalStories, fetchStoryByKey, saveLocalStory } from '@/lib/stories'
import { listModules } from '@/lib/modules'
import { guardApp } from '@/lib/auth'

/** Renders prior-proposed FR rows as markdown table rows so numbering in a
 *  fresh model call continues from where the last story in the batch left off. */
function renderPriorFRs(rows: NewRequirementRow[]): string {
  if (rows.length === 0) return ''
  const body = rows
    .map((r) => `| ${r.id} | ${r.requirement} | ${r.module ?? ''} | ${r.priority ?? ''} | ${r.status ?? ''} |`)
    .join('\n')
  return `| ID | Requirement | Module | Priority | Status |\n|----|-------------|--------|----------|--------|\n${body}`
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ app: string }> }
) {
  const { app } = await params
  const guard = await guardApp(app, 'knowledge.edit')
  if (!guard.ok) return guard.response

  const body = (await req.json()) as {
    storyKey?: string
    model?: string
    module?: string | null
    guidance?: string
    priorProposedFRs?: NewRequirementRow[]
  }
  const storyKey = body.storyKey?.trim()
  if (!storyKey) return NextResponse.json({ error: 'storyKey is required' }, { status: 400 })
  if (!body.model?.trim()) return NextResponse.json({ error: 'model is required' }, { status: 400 })

  try {
    // Prefer the locally cached copy; fall back to fetching the story live from Jira.
    const cached = (await loadLocalStories(app, { keys: [storyKey] }))[0]
    const story = cached ?? (await fetchStoryByKey(storyKey, guard.access.user.id))
    if (!story) {
      return NextResponse.json(
        { error: `Story ${storyKey} was not found locally or in Jira.` },
        { status: 404 }
      )
    }
    if (!cached) void saveLocalStory(app, story)

    const baseFRs = await getRequirements(app, body.module ?? null)
    const priorRows = Array.isArray(body.priorProposedFRs) ? body.priorProposedFRs : []
    const existingFRs = [baseFRs.trim(), renderPriorFRs(priorRows)].filter(Boolean).join('\n\n')

    const [existingFeatures, modules] = await Promise.all([
      listFeatures(app),
      listModules(app),
    ])
    const existingFeatureSlugs = existingFeatures.map((f) => f.name)
    const knownModules = modules.map((m) => m.slug)

    const breakdown = await breakStoryIntoFeatures(app, guard.access.user.id, story, body.model, {
      moduleSlug: body.module ?? null,
      existingFRs,
      existingFeatureSlugs,
      knownModules,
      guidance: body.guidance,
    })

    const features = breakdown.features.map((f) => ({
      ...f,
      exists: existingFeatureSlugs.includes(f.slug),
    }))

    return NextResponse.json({
      story: { key: story.key, summary: story.summary },
      features,
      frs: breakdown.frs satisfies ProposedFR[],
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to break down story'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
