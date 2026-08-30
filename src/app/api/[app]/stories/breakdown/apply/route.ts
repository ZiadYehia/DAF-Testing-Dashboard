import { NextRequest, NextResponse } from 'next/server'
import {
  listFeatures,
  createFeature,
  saveFeatureMetadata,
  saveFeatureKnowledge,
  addRequirementRows,
  type NewRequirementRow,
} from '@/lib/features'
import { setStoryLink } from '@/lib/requirements'
import { guardApp } from '@/lib/auth'

const FEATURE_SLUG_RE = /^[a-z0-9-]+$/

interface ApplyFeatureInput {
  slug?: string
  module?: string | null
  knowledge?: string
}

interface ApplyItemInput {
  storyKey?: string
  features?: ApplyFeatureInput[]
  frs?: NewRequirementRow[]
}

interface ItemResult {
  storyKey: string
  featuresCreated: string[]
  featuresSkipped: { slug: string; reason: string }[]
  frsAdded: string[]
  frsSkipped: string[]
  error?: string
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ app: string }> }
) {
  const { app } = await params
  const guardFeatures = await guardApp(app, 'features.create')
  if (!guardFeatures.ok) return guardFeatures.response
  const guardRequirements = await guardApp(app, 'requirements.edit')
  if (!guardRequirements.ok) return guardRequirements.response

  const body = (await req.json()) as { module?: string | null; items?: ApplyItemInput[] }
  const module = body.module ?? null
  const items = Array.isArray(body.items) ? body.items : []
  if (items.length === 0) return NextResponse.json({ error: 'items is required' }, { status: 400 })

  const results: ItemResult[] = []

  for (const item of items) {
    const storyKey = item.storyKey?.trim() ?? ''
    const result: ItemResult = {
      storyKey,
      featuresCreated: [],
      featuresSkipped: [],
      frsAdded: [],
      frsSkipped: [],
    }

    try {
      if (!storyKey) throw new Error('storyKey is required')

      // Features — validated and created one at a time so a bad row never
      // blocks the rest of the batch item.
      const existingSlugs = (await listFeatures(app)).map((f) => f.name)
      for (const feature of item.features ?? []) {
        const slug = feature.slug?.trim() ?? ''
        if (!FEATURE_SLUG_RE.test(slug)) {
          result.featuresSkipped.push({ slug: slug || '(blank)', reason: 'Invalid slug — must match ^[a-z0-9-]+$' })
          continue
        }
        if (existingSlugs.includes(slug)) {
          result.featuresSkipped.push({ slug, reason: 'A feature with this slug already exists' })
          continue
        }
        await createFeature(app, slug, feature.module ?? module)
        await saveFeatureMetadata(app, slug, { storyKey })
        await saveFeatureKnowledge(app, slug, feature.knowledge ?? '')
        existingSlugs.push(slug)
        result.featuresCreated.push(slug)
      }

      // Functional requirements — dedupe against the existing table, then link
      // every newly added row back to the story.
      const frs = item.frs ?? []
      if (frs.length > 0) {
        const { added, skipped } = await addRequirementRows(app, frs, module)
        result.frsAdded = added
        result.frsSkipped = skipped
        for (const id of added) {
          await setStoryLink(app, id, storyKey)
        }
      }
    } catch (err) {
      result.error = err instanceof Error ? err.message : 'Failed to apply breakdown'
    }

    results.push(result)
  }

  return NextResponse.json({ results })
}
