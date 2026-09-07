import fs from 'fs'
import path from 'path'
import { getDataSource } from './db'
import { getDataRoot } from './paths'
import { slugify } from './utils'
import { BugEntity, IBug, AttachmentEntity, IAttachment } from './entities'

function bugsDir(appSlug: string): string {
  return path.join(getDataRoot(), appSlug, 'bugs')
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type BugStatus = 'draft' | 'reported'

export interface BugFrontmatter {
  title: string
  status: BugStatus
  jira_key: string | null
  reported_at: string | null
  feature: string
  priority: string
  bug_type: string
  parent_key: string | null
  severity: string
  layer: string
  jira_status: string | null
  jira_reporter: string | null
  /**
   * Environment the bug was found on, e.g. "ngrok relay". Absent/null = not attributed to one.
   * The same defect on two environments is two files whose slugs differ by environment, so this
   * field says which is which without the reader parsing the Environment section.
   */
  environment?: string | null
}

export interface BugSummary {
  slug: string
  feature: string
  title: string
  status: BugStatus
  jira_key: string | null
  reported_at: string | null
  priority: string
  bug_type: string
  parent_key: string | null
  severity: string
  layer: string
  jira_status: string | null
  jira_reporter: string | null
  environment: string | null
}

export interface BugDetail extends BugSummary {
  body: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toSummary(bug: IBug): BugSummary {
  return {
    slug: bug.slug,
    feature: bug.feature,
    title: bug.title,
    status: bug.status as BugStatus,
    jira_key: bug.jiraKey,
    reported_at: bug.reportedAt ? bug.reportedAt.toISOString() : null,
    priority: bug.priority,
    bug_type: bug.bugType,
    parent_key: bug.parentKey ?? null,
    severity: bug.severity ?? '',
    layer: bug.layer ?? 'unknown',
    jira_status: bug.jiraStatus ?? null,
    jira_reporter: bug.jiraReporter ?? null,
    environment: bug.environment ?? null,
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function listBugs(appSlug: string, module?: string | null): Promise<BugSummary[]> {
  const moduleVal = module !== undefined ? module : null
  const ds = await getDataSource()
  let qb = ds
    .getRepository(BugEntity)
    .createQueryBuilder('b')
    .select(['b.id', 'b.slug', 'b.feature', 'b.title', 'b.status', 'b.jiraKey', 'b.reportedAt', 'b.priority', 'b.bugType', 'b.parentKey', 'b.severity', 'b.layer', 'b.jiraStatus', 'b.jiraReporter'])
    .where('b.appSlug = :appSlug', { appSlug })
    // Explicit IS NULL SQL rather than IsNull() — see the comment on the
    // equivalent features.ts query: under Turbopack the FindOperator can be
    // built from a different typeorm module instance than the DataSource
    // uses, so its instanceof check fails and it gets bound as a literal param.
    .andWhere('b.deletedAt IS NULL')
  if (moduleVal === null) {
    qb = qb.andWhere('b.module IS NULL')
  } else if (moduleVal) {
    qb = qb.andWhere('b.module = :module', { module: moduleVal })
  }
  const bugs = await qb.orderBy('b.feature', 'ASC').addOrderBy('b.slug', 'ASC').getMany()
  return bugs.map(toSummary)
}

export async function getBug(
  appSlug: string,
  feature: string,
  slug: string
): Promise<BugDetail | null> {
  const ds = await getDataSource()
  const bug = await ds.getRepository(BugEntity).findOne({ where: { appSlug, feature, slug } })
  if (!bug) return null
  return { ...toSummary(bug), body: bug.body }
}

/** Slug + jiraKey + body for every (non-deleted) bug in a feature, across all
 *  modules. Used by execution-export.ts's testcase-to-bug heuristic linking,
 *  which needs full bug bodies to scan for a testcase-ID mention — shaped
 *  differently from BugSummary (which omits body) so it gets its own helper
 *  rather than overloading listBugs/getBug. */
export async function listBugsWithBodies(
  appSlug: string,
  feature: string
): Promise<{ slug: string; jiraKey: string | null; body: string }[]> {
  const ds = await getDataSource()
  const rows = await ds
    .getRepository(BugEntity)
    .createQueryBuilder('b')
    .select(['b.slug', 'b.jiraKey', 'b.body'])
    .where('b.appSlug = :appSlug', { appSlug })
    .andWhere('b.feature = :feature', { feature })
    .getMany()
  return rows.map((r) => ({ slug: r.slug, jiraKey: r.jiraKey, body: r.body }))
}

export async function saveBug(
  appSlug: string,
  feature: string,
  slug: string,
  body: string,
  meta: Partial<BugFrontmatter>
): Promise<void> {
  const ds = await getDataSource()
  const repo = ds.getRepository(BugEntity)
  const existing = await repo.findOne({ where: { appSlug, feature, slug } })
  if (existing) {
    const updated: Partial<IBug> = {
      body, title: meta.title ?? existing.title, status: meta.status ?? existing.status,
      jiraKey: meta.jira_key !== undefined ? meta.jira_key : existing.jiraKey,
      reportedAt: meta.reported_at !== undefined ? (meta.reported_at ? new Date(meta.reported_at) : null) : existing.reportedAt,
      priority: meta.priority ?? existing.priority, bugType: meta.bug_type ?? existing.bugType,
      parentKey: meta.parent_key !== undefined ? meta.parent_key : existing.parentKey,
      environment: meta.environment !== undefined ? meta.environment : existing.environment,
      severity: meta.severity ?? existing.severity, layer: meta.layer ?? existing.layer,
      jiraStatus: meta.jira_status !== undefined ? meta.jira_status : existing.jiraStatus,
    }
    await repo.update(existing.id, updated)
  } else {
    await repo.save({ appSlug, feature, slug, body, title: meta.title ?? slug, status: meta.status ?? 'draft', jiraKey: meta.jira_key ?? null, reportedAt: meta.reported_at ? new Date(meta.reported_at) : null, priority: meta.priority ?? '', bugType: meta.bug_type ?? '', parentKey: meta.parent_key ?? null, severity: meta.severity ?? '', layer: meta.layer ?? 'unknown', jiraStatus: meta.jira_status ?? null, environment: meta.environment ?? null })
  }
}

function sanitizeTitle(title: string): string {
  // If the AI returned a slug-format title (all-lowercase, hyphens, no spaces),
  // convert it to Title Case so it reads as a natural language sentence.
  const isSlugLike = /^[a-z0-9][a-z0-9-]+[a-z0-9]$/.test(title) && title.includes('-') && !title.includes(' ')
  if (!isSlugLike) return title
  return title.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export interface CreateBugInput {
  feature: string
  title: string
  body: string
  priority?: string
  bug_type?: string
  severity?: string
  layer?: string
  parent_key?: string | null
  module?: string | null
}

export async function createBug(appSlug: string, input: CreateBugInput): Promise<string> {
  const { feature, title, body } = input
  const priority = input.priority ?? ''
  const bug_type = input.bug_type ?? ''
  const severity = input.severity ?? ''
  const layer = input.layer ?? 'unknown'
  const displayTitle = sanitizeTitle(title)
  const baseSlug = slugify(title).slice(0, 80)
  const parentKey = input.parent_key ?? null
  const moduleVal = input.module ?? null

  // Auto-scaffold the feature directory so new features appear in the features list
  // (features.ts still enumerates features off the filesystem — out of scope here,
  // so this side effect stays until that domain migrates too).
  const featureDir = path.join(getDataRoot(), appSlug, 'features', feature)
  if (!fs.existsSync(featureDir)) {
    fs.mkdirSync(featureDir, { recursive: true })
  }

  const ds = await getDataSource()
  const repo = ds.getRepository(BugEntity)
  let finalSlug = baseSlug
  let counter = 1
  // Determine unique slug via DB query loop (bugs are DB-only now — no markdown to scan)
  while (await repo.findOne({ where: { appSlug, feature, slug: finalSlug } })) {
    finalSlug = `${baseSlug}-${counter++}`
  }
  await repo.save({ appSlug, feature, slug: finalSlug, title: displayTitle, body, status: 'draft', jiraKey: null, reportedAt: null, priority, bugType: bug_type, parentKey, severity, layer, module: moduleVal, jiraStatus: null })
  return finalSlug
}

export async function changeBugFeature(
  appSlug: string,
  oldFeature: string,
  slug: string,
  newFeature: string
): Promise<void> {
  const ds = await getDataSource()
  await ds.getRepository(BugEntity).update({ appSlug, feature: oldFeature, slug }, { feature: newFeature })
  // Move the attachments dir on disk to follow the bug's new feature — best-effort,
  // done after the DB commit, tolerate a missing dir (bug may have no attachments).
  const oldDir = attachmentsDir(appSlug, oldFeature, slug)
  const newDir = attachmentsDir(appSlug, newFeature, slug)
  if (fs.existsSync(oldDir)) {
    try {
      fs.mkdirSync(path.dirname(newDir), { recursive: true })
      fs.renameSync(oldDir, newDir)
    } catch {
      // Non-fatal: DB is source of truth for feature; disk layout can be repaired later
    }
  }
}

export async function getBugStats(
  appSlug: string
): Promise<{ total: number; draft: number; reported: number }> {
  const ds = await getDataSource()
  const repo = ds.getRepository(BugEntity)
  // Explicit IS NULL SQL (not IsNull()) for the same Turbopack/FindOperator
  // reason as listBugs — keeps deletedAt semantics consistent across both.
  const base = () => repo.createQueryBuilder('b').where('b.appSlug = :appSlug', { appSlug }).andWhere('b.deletedAt IS NULL')
  const [total, draft, reported] = await Promise.all([
    base().getCount(),
    base().andWhere('b.status = :status', { status: 'draft' }).getCount(),
    base().andWhere('b.status = :status', { status: 'reported' }).getCount(),
  ])
  return { total, draft, reported }
}

// ─── Attachments ───────────────────────────────────────────────────────────────

/** Allowed attachment types (images + video) and their MIME types, keyed by lowercase extension. */
export const ATTACHMENT_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
}

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024 // 25 MB

export function attachmentMimeForName(fileName: string): string | null {
  const ext = path.extname(fileName).toLowerCase()
  return ATTACHMENT_MIME[ext] ?? null
}

export interface AttachmentSummary {
  fileName: string
  mimeType: string
  uploadedAt: string | null
  size: number
}

function attachmentsDir(appSlug: string, feature: string, slug: string): string {
  return path.join(bugsDir(appSlug), feature, `${slug}-attachments`)
}

/** Resolve the bug row id for (app, feature, slug), or null if not in DB. */
async function findBugId(appSlug: string, feature: string, slug: string): Promise<number | null> {
  const ds = await getDataSource()
  const bug = await ds.getRepository(BugEntity).findOne({
    where: { appSlug, feature, slug },
    select: ['id'],
  })
  return bug?.id ?? null
}

export async function saveAttachment(
  appSlug: string,
  feature: string,
  slug: string,
  fileName: string,
  mimeType: string,
  buffer: Buffer
): Promise<void> {
  // Disk is the source of truth for attachment bytes.
  const dir = attachmentsDir(appSlug, feature, slug)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, fileName), buffer)
  try {
    const ds = await getDataSource()
    const bugId = await findBugId(appSlug, feature, slug)
    if (bugId === null) return // DB has no bug row yet — filesystem write above is sufficient
    const attachmentRepo = ds.getRepository(AttachmentEntity)
    const existing = await attachmentRepo
      .createQueryBuilder('a')
      .where('a.bug = :bugId AND a.fileName = :fn', { bugId, fn: fileName })
      .getOne()
    // Metadata-only row: data stays NULL, byteSize records the size. The blob
    // itself lives on disk (written above), not in the DB.
    if (existing) {
      await attachmentRepo.update(existing.id, { data: null, mimeType, byteSize: buffer.length })
    } else {
      await attachmentRepo.save({ bug: { id: bugId }, fileName, mimeType, data: null, byteSize: buffer.length, uploadedAt: new Date() } as unknown as IAttachment)
    }
  } catch {
    // DB unavailable — filesystem write above is sufficient
  }
}

export async function listAttachments(
  appSlug: string,
  feature: string,
  slug: string
): Promise<AttachmentSummary[]> {
  try {
    const ds = await getDataSource()
    const bugId = await findBugId(appSlug, feature, slug)
    if (bugId === null) throw new Error('not in DB')
    const rows = await ds
      .getRepository(AttachmentEntity)
      .createQueryBuilder('a')
      .select('a.fileName', 'fileName')
      .addSelect('a.mimeType', 'mimeType')
      .addSelect('a.uploadedAt', 'uploadedAt')
      // byteSize is the metadata-era size column; DATALENGTH(a.data) covers
      // legacy rows that still carry the actual blob (byteSize NULL there).
      .addSelect('COALESCE(a.byteSize, DATALENGTH(a.data))', 'size')
      .where('a.bug = :bugId', { bugId })
      .orderBy('a.uploadedAt', 'ASC')
      .getRawMany<{ fileName: string; mimeType: string; uploadedAt: Date | null; size: number }>()
    return rows.map((r) => ({
      fileName: r.fileName,
      mimeType: r.mimeType,
      uploadedAt: r.uploadedAt ? new Date(r.uploadedAt).toISOString() : null,
      size: Number(r.size) || 0,
    }))
  } catch {
    // Fallback: filesystem
    const dir = attachmentsDir(appSlug, feature, slug)
    if (!fs.existsSync(dir)) return []
    return fs.readdirSync(dir)
      .filter((f) => attachmentMimeForName(f) !== null)
      .map((f) => {
        const stat = fs.statSync(path.join(dir, f))
        return {
          fileName: f,
          mimeType: attachmentMimeForName(f) ?? 'application/octet-stream',
          uploadedAt: stat.mtime.toISOString(),
          size: stat.size,
        }
      })
      .sort((a, b) => a.uploadedAt!.localeCompare(b.uploadedAt!))
  }
}

export async function getAttachmentData(
  appSlug: string,
  feature: string,
  slug: string,
  fileName: string
): Promise<{ data: Buffer; mimeType: string } | null> {
  const filePath = path.join(attachmentsDir(appSlug, feature, slug), fileName)
  try {
    const ds = await getDataSource()
    const bugId = await findBugId(appSlug, feature, slug)
    if (bugId !== null) {
      const attachment = await ds
        .getRepository(AttachmentEntity)
        .createQueryBuilder('a')
        .select(['a.id', 'a.data', 'a.mimeType'])
        .where('a.bug = :bugId AND a.fileName = :fn', { bugId, fn: fileName })
        .getOne()
      if (attachment) {
        // Metadata row confirms the attachment exists — disk is the source of
        // truth for bytes post-migration (DB `data` is NULL for new rows).
        if (fs.existsSync(filePath)) {
          return { data: fs.readFileSync(filePath), mimeType: attachment.mimeType }
        }
        // Legacy fallback: pre-migration rows may still carry the actual blob.
        if (attachment.data) return { data: attachment.data, mimeType: attachment.mimeType }
        return null
      }
    }
  } catch {
    // DB unreachable — fall through to a disk-only lookup below
  }
  // Fallback: no DB metadata row (or DB unreachable) — read straight off disk
  if (!fs.existsSync(filePath)) return null
  return { data: fs.readFileSync(filePath), mimeType: attachmentMimeForName(fileName) ?? 'application/octet-stream' }
}

/** Like getAttachmentData but for every attachment — used to push blobs to Jira. */
export async function getAttachmentsForJira(
  appSlug: string,
  feature: string,
  slug: string
): Promise<{ fileName: string; mimeType: string; data: Buffer }[]> {
  const summaries = await listAttachments(appSlug, feature, slug)
  const out: { fileName: string; mimeType: string; data: Buffer }[] = []
  for (const s of summaries) {
    const d = await getAttachmentData(appSlug, feature, slug, s.fileName)
    if (d) out.push({ fileName: s.fileName, mimeType: d.mimeType, data: d.data })
  }
  return out
}

/** Soft-deletes a bug: sets `deletedAt` on the DB row (source of truth). The
 *  row and its attachments (metadata + on-disk files) are all left in place —
 *  only listBugs/syncJiraStatuses hide it — so the delete is recoverable.
 *  Returns false when no DB row exists for (appSlug, feature, slug). */
export async function softDeleteBug(
  appSlug: string,
  feature: string,
  slug: string
): Promise<boolean> {
  const id = await findBugId(appSlug, feature, slug)
  if (id === null) return false
  const ds = await getDataSource()
  await ds.getRepository(BugEntity).update(id, { deletedAt: new Date() })
  return true
}

export async function deleteAttachment(
  appSlug: string,
  feature: string,
  slug: string,
  fileName: string
): Promise<boolean> {
  // Delete from filesystem first
  const filePath = path.join(attachmentsDir(appSlug, feature, slug), fileName)
  const existsOnDisk = fs.existsSync(filePath)
  if (existsOnDisk) fs.unlinkSync(filePath)
  try {
    const ds = await getDataSource()
    const bugId = await findBugId(appSlug, feature, slug)
    if (bugId === null) return existsOnDisk
    const attachmentRepo = ds.getRepository(AttachmentEntity)
    const attachment = await attachmentRepo
      .createQueryBuilder('a')
      .where('a.bug = :bugId AND a.fileName = :fn', { bugId, fn: fileName })
      .getOne()
    if (attachment) await attachmentRepo.delete(attachment.id)
    return existsOnDisk || !!attachment
  } catch {
    return existsOnDisk
  }
}

export async function listBugFeatures(appSlug: string): Promise<string[]> {
  const ds = await getDataSource()
  const rows = await ds
    .getRepository(BugEntity)
    .createQueryBuilder('b')
    .select('DISTINCT b.feature', 'feature')
    .where('b.appSlug = :appSlug', { appSlug })
    .getRawMany<{ feature: string }>()
  return rows.map((r) => r.feature).sort()
}
