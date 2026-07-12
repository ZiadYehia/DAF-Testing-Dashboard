import { getDataSource } from './db'
import { ApprovedExampleEntity, FeatureEntity, IApprovedExample } from './entities'

export interface ApprovedExampleSummary {
  id: number
  feature: string
  sourceVersion: number | null
  createdAt: string
  /** Byte length, for a lightweight list view (full content fetched on demand). */
  size: number
}

/** List approved examples for an app, optionally scoped to one feature. DB-only. */
export async function listApprovedExamples(
  appSlug: string,
  featureName?: string
): Promise<ApprovedExampleSummary[]> {
  try {
    const ds = await getDataSource()
    const qb = ds
      .getRepository(ApprovedExampleEntity)
      .createQueryBuilder('ae')
      .innerJoinAndSelect('ae.feature', 'f')
      .where('f.appSlug = :appSlug', { appSlug })
    if (featureName) qb.andWhere('f.name = :name', { name: featureName })
    const rows = await qb.orderBy('ae.createdAt', 'DESC').getMany()
    return rows.map((r) => ({
      id: r.id,
      feature: r.feature?.name ?? '',
      sourceVersion: r.sourceVersion,
      createdAt: r.createdAt ? r.createdAt.toISOString() : '',
      size: (r.content ?? '').length,
    }))
  } catch {
    return []
  }
}

/**
 * Promote a test-case table into the approved few-shot pool. Re-approving the
 * same (feature, version) updates the stored content instead of duplicating.
 * Returns the row id, or null if the DB is unavailable.
 */
export async function approveExample(
  appSlug: string,
  featureName: string,
  content: string,
  sourceVersion?: number | null
): Promise<number | null> {
  if (!content.trim()) throw new Error('Cannot approve empty content')
  const ds = await getDataSource()
  const feature = await ds.getRepository(FeatureEntity).findOne({ where: { appSlug, name: featureName } })
  if (!feature) throw new Error('Feature not found')

  const repo = ds.getRepository(ApprovedExampleEntity)
  if (sourceVersion != null) {
    const existing = await repo
      .createQueryBuilder('ae')
      .innerJoin('ae.feature', 'f')
      .where('f.id = :fid', { fid: feature.id })
      .andWhere('ae.sourceVersion = :v', { v: sourceVersion })
      .getOne()
    if (existing) {
      await repo.update(existing.id, { content, source: 'approved' })
      return existing.id
    }
  }
  const saved = (await repo.save({
    feature: { id: feature.id },
    content,
    source: 'approved',
    sourceVersion: sourceVersion ?? null,
  } as unknown as IApprovedExample)) as IApprovedExample
  return saved.id
}

/** Remove an approved example by id (scoped to the app for safety). */
export async function deleteApprovedExample(appSlug: string, id: number): Promise<boolean> {
  try {
    const ds = await getDataSource()
    const row = await ds
      .getRepository(ApprovedExampleEntity)
      .createQueryBuilder('ae')
      .innerJoin('ae.feature', 'f')
      .where('ae.id = :id', { id })
      .andWhere('f.appSlug = :appSlug', { appSlug })
      .getOne()
    if (!row) return false
    await ds.getRepository(ApprovedExampleEntity).delete(row.id)
    return true
  } catch {
    return false
  }
}

/**
 * Approved examples to embed in a test-case prompt, most relevant first:
 * same feature → same module → anything else. Capped at `limit`. DB-only;
 * returns [] when none exist so callers fall back to the static example files.
 */
export async function getApprovedExamplesForPrompt(
  appSlug: string,
  featureName: string,
  module: string | null,
  limit = 2
): Promise<Array<{ label: string; content: string }>> {
  try {
    const ds = await getDataSource()
    const rows = await ds
      .getRepository(ApprovedExampleEntity)
      .createQueryBuilder('ae')
      .innerJoinAndSelect('ae.feature', 'f')
      .where('f.appSlug = :appSlug', { appSlug })
      .orderBy('ae.createdAt', 'DESC')
      .getMany()
    if (rows.length === 0) return []

    const rank = (r: IApprovedExample) => {
      if (r.feature?.name === featureName) return 0
      if (module && r.feature?.module === module) return 1
      return 2
    }
    return rows
      .sort((a, b) => rank(a) - rank(b))
      .slice(0, limit)
      .map((r) => ({
        label: `Approved example: ${r.feature?.name ?? 'feature'}${r.sourceVersion ? ` v${r.sourceVersion}` : ''}`,
        content: r.content,
      }))
  } catch {
    return []
  }
}
