import { getDataSource } from './db'
import { FeatureEntity, AcceptanceCriterionEntity } from './entities'
import type { AcceptanceCriterion } from './ai'

export interface AcStats {
  hasAcceptanceCriteria: boolean
  uncoveredAcCount: number
}

export function computeAcStats(acs: AcceptanceCriterion[]): AcStats {
  const parentIds = new Set(acs.filter(a => a.parentId).map(a => a.parentId as string))
  const leafAcs = acs.filter(a => !parentIds.has(a.id))
  const uncoveredAcCount = leafAcs.filter(ac => {
    if (ac.manualCoverage === 'covered') return false
    if (ac.manualCoverage === 'not_covered') return true
    if (ac.aiAnalyzedAt !== null) return ac.aiCoveredBy.length === 0
    return false
  }).length
  return { hasAcceptanceCriteria: acs.length > 0, uncoveredAcCount }
}

function rowsToAcs(rows: { criterionKey: string; text: string; parentId: string | null; manualCoverage: string | null; aiCoveredBy: string; aiAnalyzedAt: Date | null }[]): AcceptanceCriterion[] {
  return rows.map(r => ({
    id: r.criterionKey,
    text: r.text,
    parentId: r.parentId,
    manualCoverage: r.manualCoverage as AcceptanceCriterion['manualCoverage'],
    aiCoveredBy: JSON.parse(r.aiCoveredBy || '[]') as string[],
    aiAnalyzedAt: r.aiAnalyzedAt ? r.aiAnalyzedAt.toISOString() : null,
  }))
}

/** Read a feature's acceptance criteria — DB-only. Returns [] if the feature doesn't exist. */
export async function getAcs(appSlug: string, featureName: string): Promise<AcceptanceCriterion[]> {
  const ds = await getDataSource()
  const feature = await ds.getRepository(FeatureEntity).findOne({ where: { appSlug, name: featureName } })
  if (!feature) return []

  const rows = await ds.getRepository(AcceptanceCriterionEntity)
    .createQueryBuilder('ac')
    .where('ac.featureId = :fId', { fId: feature.id })
    .orderBy('ac.sortOrder', 'ASC')
    .getMany()

  return rowsToAcs(rows)
}

/**
 * Replace a feature's whole acceptance-criteria set — DB-only. Throws if the
 * feature doesn't exist, or if the DB write fails, so callers see the failure
 * instead of silently losing the save.
 */
export async function saveAcs(appSlug: string, featureName: string, acs: AcceptanceCriterion[]): Promise<void> {
  const ds = await getDataSource()
  const feature = await ds.getRepository(FeatureEntity).findOne({ where: { appSlug, name: featureName } })
  if (!feature) throw new Error(`Feature not found: ${appSlug}/${featureName}`)

  // Replace whole set: delete existing rows, insert new ones
  await ds.query('DELETE FROM acceptance_criteria WHERE featureId = @0', [feature.id])

  if (acs.length > 0) {
    await ds.getRepository(AcceptanceCriterionEntity).insert(
      acs.map((ac, idx) => ({
        criterionKey: ac.id,
        text: ac.text,
        parentId: ac.parentId,
        manualCoverage: ac.manualCoverage,
        aiCoveredBy: JSON.stringify(ac.aiCoveredBy),
        aiAnalyzedAt: ac.aiAnalyzedAt ? new Date(ac.aiAnalyzedAt) : null,
        sortOrder: idx,
        feature: { id: feature.id },
      }))
    )
  }
}

/** Bulk-fetch AC stats for a list of feature IDs in a single query. */
export async function getAcStatsBulk(featureIds: number[]): Promise<Map<number, AcStats>> {
  if (featureIds.length === 0) return new Map()
  try {
    const ds = await getDataSource()
    const placeholders = featureIds.map((_, i) => `@${i}`).join(', ')
    const rows = await ds.query(
      `SELECT featureId, criterionKey, text, parentId, manualCoverage, aiCoveredBy, aiAnalyzedAt
       FROM acceptance_criteria WHERE featureId IN (${placeholders})`,
      featureIds
    ) as Array<{ featureId: number; criterionKey: string; text: string; parentId: string | null; manualCoverage: string | null; aiCoveredBy: string; aiAnalyzedAt: Date | null }>

    const byFeature = new Map<number, typeof rows>()
    for (const row of rows) {
      const fId = Number(row.featureId)
      const list = byFeature.get(fId) ?? []
      list.push(row)
      byFeature.set(fId, list)
    }

    const result = new Map<number, AcStats>()
    for (const fId of featureIds) {
      const featureRows = byFeature.get(fId) ?? []
      result.set(fId, computeAcStats(rowsToAcs(featureRows)))
    }
    return result
  } catch {
    return new Map()
  }
}
