import { NextRequest, NextResponse } from 'next/server'
import { getRequirements } from '@/lib/features'
import { splitStoryIntoFRs } from '@/lib/ai'
import { loadLocalStories, fetchStoryByKey } from '@/lib/stories'
import { guardApp } from '@/lib/auth'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ app: string }> }
) {
  const { app } = await params
  const guard = await guardApp(app, 'requirements.edit')
  if (!guard.ok) return guard.response

  const body = await req.json() as {
    storyKey?: string
    model?: string
    module?: string | null
    guidance?: string
  }
  const storyKey = body.storyKey?.trim()
  if (!storyKey) return NextResponse.json({ error: 'storyKey is required' }, { status: 400 })
  if (!body.model?.trim()) return NextResponse.json({ error: 'model is required' }, { status: 400 })

  try {
    // Prefer the locally cached copy; fall back to fetching the story live from Jira.
    const story =
      (await loadLocalStories(app, { keys: [storyKey] }))[0] ??
      (await fetchStoryByKey(storyKey))
    if (!story) {
      return NextResponse.json(
        { error: `Story ${storyKey} was not found locally or in Jira.` },
        { status: 404 }
      )
    }

    const existingFRs = await getRequirements(app, body.module ?? null)
    const proposals = await splitStoryIntoFRs(app, story, body.model, {
      moduleSlug: body.module ?? null,
      existingFRs,
      guidance: body.guidance,
    })

    return NextResponse.json({
      story: { key: story.key, summary: story.summary },
      proposals,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to split story'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
