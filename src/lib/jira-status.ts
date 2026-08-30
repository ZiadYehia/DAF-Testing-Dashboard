import { getDataSource } from './db'
import { BugEntity } from './entities'
import { fetchIssueStatuses } from './jira'

/**
 * Refresh the cached Jira status for every bug in an app that has a jiraKey
 * (covers the root module and all prefixed modules, since bugs across modules
 * share the same `bugs` table). Individual row failures are swallowed so one
 * bad write can't fail the whole sync; an unreachable Jira propagates so the
 * caller can surface a 502.
 */
export async function syncJiraStatuses(appSlug: string, userId: number): Promise<void> {
  const ds = await getDataSource()
  const repo = ds.getRepository(BugEntity)
  const bugs = await repo
    .createQueryBuilder('b')
    .where('b.appSlug = :appSlug', { appSlug })
    .andWhere('b.jiraKey IS NOT NULL')
    .andWhere('b.deletedAt IS NULL')
    .getMany()
  if (bugs.length === 0) return

  const keys = bugs.map((b) => b.jiraKey as string)
  const infoMap = await fetchIssueStatuses(keys, userId)
  const now = new Date()

  for (const bug of bugs) {
    const info = infoMap.get(bug.jiraKey as string) ?? null
    const newStatus = info?.status ?? null
    const newReporter = info?.reporter ?? null
    // Someone can re-parent the issue in Jira itself (move it under a different
    // epic/story); pick that up here so local parentKey — and everything derived
    // from it (bug format variant, labels, issue type on the next update) — stays
    // in step. Only trust it when Jira actually reports a parent field for this
    // batch (info !== null); a lookup failure must not wipe out a known parent.
    const newParentKey = info ? info.parentKey : bug.parentKey
    if (newStatus === bug.jiraStatus && newReporter === (bug.jiraReporter ?? null) && newParentKey === bug.parentKey) continue
    try {
      await repo.update(bug.id, { jiraStatus: newStatus, jiraStatusSyncedAt: now, jiraReporter: newReporter, parentKey: newParentKey })
    } catch {
      // Non-fatal: a single row failure must not fail the whole sync
    }
  }
}
