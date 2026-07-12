import fs from 'fs'
import path from 'path'
import { getDataSource } from './db'
import { FeatureEntity, AcceptanceCriterionEntity } from './entities'
import type { AcceptanceCriterion } from './ai'
import { getDataRoot } from './paths'

function acFilePath(appSlug: string, featureName: string): string {
  return path.join(getDataRoot(), appSlug, 'features', featureName, 'acceptance-criteria.json')
}

function readAcsFromFs(appSlug: string, featureName: string): AcceptanceCriterion[] {
  const file = acFilePath(appSlug, featureName)
  if (!fs.existsSync(file)) return []
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as AcceptanceCriterion[]
    return raw.map(ac => ({ ...ac, parentId: ac.parentId ?? null }))
  } catch { return [] }
}

function writeAcsToFs(appSlug: string, featureName: string, acs: AcceptanceCriterion[]): void {
  const file = acFilePath(appSlug, featureName)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(acs, null, 2), 'utf-8')
}

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

export async function getAcs(appSlug: string, featureName: string): Promise<AcceptanceCriterion[]> {
  try {
    const ds = await getDataSource()
    const feature = await ds.getRepository(FeatureEntity).findOne({ where: { appSlug, name: featureName } })
    if (!feature) return readAcsFromFs(appSlug, featureName)

    const rows = await ds.getRepository(AcceptanceCriterionEntity)
      .createQueryBuilder('ac')
      .where('ac.featureId = :fId', { fId: feature.id })
      .orderBy('ac.sortOrder', 'ASC')
      .getMany()

    // No DB rows yet — data not migrated, fall back to FS
    if (rows.length === 0 && fs.existsSync(acFilePath(appSlug, featureName))) {
      return readAcsFromFs(appSlug, featureName)
    }

    return rowsToAcs(rows)
  } catch {
    return readAcsFromFs(appSlug, featureName)
  }
}

export async function saveAcs(appSlug: string, featureName: string, acs: AcceptanceCriterion[]): Promise<void> {
  // FS write first — keeps file available for Copilot agents and as fallback
  writeAcsToFs(appSlug, featureName, acs)

  try {
    const ds = await getDataSource()
    const feature = await ds.getRepository(FeatureEntity).findOne({ where: { appSlug, name: featureName } })
    if (!feature) return

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
  } catch {
    // DB write failed — FS write above ensures data is not lost
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
