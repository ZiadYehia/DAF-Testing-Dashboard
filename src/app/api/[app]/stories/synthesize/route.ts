import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { fetchStories, loadLocalStories, synthesizeKnowledge } from '@/lib/stories'
import { writeKnowledgeFile } from '@/lib/knowledge'
import { extractAcceptanceCriteria } from '@/lib/ai'
import { guardApp } from '@/lib/auth'
import { getDataRoot } from '@/lib/paths'

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

/** Pick the default source: local if any stories exist in DB or FS, else jira. */
async function defaultSource(appSlug: string): Promise<'jira' | 'local'> {
  const local = await loadLocalStories(appSlug)
  return local.length > 0 ? 'local' : 'jira'
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ app: string }> }
) {
  const { app } = await params
  const guard = await guardApp(app, 'knowledge.edit')
  if (!guard.ok) return guard.response

  const body = (await req.json()) as {
    module?: string
    model?: string
    jql?: string
    save?: boolean
    /** When saving, the (possibly edited) preview content to write verbatim. */
    content?: string
    /** Where to read stories from. Defaults to local if any local stories exist, else jira. */
    source?: 'jira' | 'local'
    /** Optional explicit story keys (DT-NNNN) for the local path. */
    keys?: string[]
    /** When set, save to features/{featureSlug}/knowledge.md instead of the knowledge base. */
    featureSlug?: string
    /** When set (and featureSlug is absent), save to modules/{moduleSlug}/knowledge/ instead of app-level knowledge/. */
    moduleSlug?: string
    /** When true, refine the existing knowledge doc with the stories instead of regenerating from scratch. */
    refresh?: boolean
  }

  if (!body.module?.trim()) {
    return NextResponse.json({ error: 'module is required' }, { status: 400 })
  }

  try {
    // Save path: write the already-synthesized (and possibly edited) content verbatim.
    if (body.save && body.content?.trim()) {
      if (body.featureSlug) {
        const featureDir = path.join(getDataRoot(), app, 'features', body.featureSlug)
        fs.mkdirSync(featureDir, { recursive: true })
        fs.writeFileSync(path.join(featureDir, 'knowledge.md'), body.content, 'utf-8')
        return NextResponse.json({ content: body.content, featureSlug: body.featureSlug, destination: 'feature' })
      }
      const filename = `${slugify(body.module)}-knowledge.md`
      writeKnowledgeFile(app, filename, body.content, { allowCreate: true, module: body.moduleSlug ?? null })
      return NextResponse.json({ content: body.content, filename, moduleSlug: body.moduleSlug ?? null, destination: body.moduleSlug ? 'module-knowledge' : 'knowledge' })
    }

    if (!body.model?.trim()) {
      return NextResponse.json({ error: 'model is required' }, { status: 400 })
    }

    const source = body.source ?? await defaultSource(app)
    const stories =
      source === 'local'
        ? await loadLocalStories(app, { module: body.module, keys: body.keys })
        : await fetchStories({ module: body.module, jql: body.jql })

    if (stories.length === 0) {
      return NextResponse.json(
        { error: 'No stories found for that module / JQL.' },
        { status: 404 }
      )
    }

    // Refresh mode: load the current knowledge doc so the model refines it
    // (preserving manual edits) rather than regenerating from scratch.
    let priorDoc: string | undefined
    if (body.refresh) {
      let priorPath: string | null = null
      if (body.featureSlug) {
        priorPath = path.join(getDataRoot(), app, 'features', body.featureSlug, 'knowledge.md')
      } else {
        const filename = `${slugify(body.module)}-knowledge.md`
        const dir = body.moduleSlug
          ? path.join(getDataRoot(), app, 'modules', body.moduleSlug, 'knowledge')
          : path.join(getDataRoot(), app, 'knowledge')
        priorPath = path.join(dir, filename)
      }
      if (priorPath && fs.existsSync(priorPath)) {
        const existing = fs.readFileSync(priorPath, 'utf-8').trim()
        if (existing) priorDoc = existing
      }
    }

    const content = await synthesizeKnowledge(app, body.module, stories, body.model, priorDoc)

    let filename: string | null = null
    let featureSlugSaved: string | null = null
    let destination: 'knowledge' | 'feature' = 'knowledge'
    let acCount = 0
    if (body.save) {
      if (body.featureSlug) {
        const featureDir = path.join(getDataRoot(), app, 'features', body.featureSlug)
        fs.mkdirSync(featureDir, { recursive: true })
        fs.writeFileSync(path.join(featureDir, 'knowledge.md'), content, 'utf-8')
        featureSlugSaved = body.featureSlug
        destination = 'feature'
        // Auto-extract ACs from synthesized knowledge — only if none exist yet
        const acFile = path.join(featureDir, 'acceptance-criteria.json')
        if (!fs.existsSync(acFile)) {
          try {
            const extracted = await extractAcceptanceCriteria(content, body.model!)
            if (extracted.length > 0) {
              fs.writeFileSync(acFile, JSON.stringify(extracted, null, 2), 'utf-8')
              acCount = extracted.length
            }
          } catch {
            // Non-fatal — user can add ACs manually from the Coverage tab
          }
        }
      } else {
        filename = `${slugify(body.module)}-knowledge.md`
        writeKnowledgeFile(app, filename, content, { allowCreate: true, module: body.moduleSlug ?? null })
      }
    }

    return NextResponse.json({
      content,
      filename,
      featureSlug: featureSlugSaved,
      destination,
      source,
      storyCount: stories.length,
      stories: stories.map((s) => ({ key: s.key, summary: s.summary })),
      acCount,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Synthesis failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
