import { NextRequest, NextResponse } from 'next/server'
import { fetchStories, loadLocalStories, saveLocalStory } from '@/lib/stories'
import { guardApp } from '@/lib/auth'

/** Pick the default source: local if any DT-*.md exists, else jira. */
async function defaultSource(appSlug: string): Promise<'jira' | 'local'> {
  const local = await loadLocalStories(appSlug)
  return local.length > 0 ? 'local' : 'jira'
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ app: string }> }
) {
  const { app } = await params
  const guard = await guardApp(app, 'knowledge.view')
  if (!guard.ok) return guard.response

  const sp = req.nextUrl.searchParams
  const moduleVal = sp.get('module') ?? undefined
  const jql = sp.get('jql') ?? undefined
  const search = sp.get('search') ?? undefined
  const source = (sp.get('source') as 'jira' | 'local' | null) ?? await defaultSource(app)

  try {
    const stories =
      source === 'local'
        ? await loadLocalStories(app, { module: moduleVal, search })
        : await fetchStories({ module: moduleVal, jql, appSlug: app, search }, guard.access.user.id)
    // Fire-and-forget cache so breakdown/split flows work offline later — doesn't block the response.
    if (source !== 'local') void Promise.allSettled(stories.map((s) => saveLocalStory(app, s)))
    return NextResponse.json({ source, stories })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch stories'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
