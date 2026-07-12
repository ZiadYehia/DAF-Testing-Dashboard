import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { IsNull, type DataSource } from 'typeorm'
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
  }
}

/** Raw shape read off a matter() frontmatter block — every field optional/untyped
 *  since it comes straight from user/AI-edited YAML. */
type RawFrontmatterFields = {
  title?: unknown; status?: unknown; jira_key?: unknown; reported_at?: unknown
  priority?: unknown; bug_type?: unknown; parent_key?: unknown; severity?: unknown
  layer?: unknown; jira_status?: unknown; jira_reporter?: unknown
}

/** Maps frontmatter-shaped fields (or an equivalent snake_case field bag built from
 *  an IBug) into a BugSummary, applying the same fallback defaults used everywhere
 *  bug metadata is read from markdown. Shared by listBugs/getBug filesystem fallbacks
 *  and by writeBugMarkdown (which feeds it IBug fields under the frontmatter names). */
function summaryFromFrontmatter(data: RawFrontmatterFields, slug: string, feature: string): BugSummary {
  return {
    slug, feature,
    title: (data.title as string | undefined) ?? slug,
    status: ((data.status as BugStatus | undefined) ?? 'draft'),
    jira_key: (data.jira_key as string | null | undefined) ?? null,
    reported_at: (data.reported_at as string | null | undefined) ?? null,
    priority: (data.priority as string | undefined) ?? '',
    bug_type: (data.bug_type as string | undefined) ?? '',
    parent_key: (data.parent_key as string | null | undefined) ?? null,
    severity: (data.severity as string | undefined) ?? '',
    layer: (data.layer as string | undefined) ?? 'unknown',
    jira_status: (data.jira_status as string | null | undefined) ?? null,
    jira_reporter: (data.jira_reporter as string | null | undefined) ?? null,
  }
}

/** Self-heal: if priority/bugType are empty on the DB row but present in the
 *  markdown frontmatter, copy them onto `bug` (mutates) and persist the patch.
 *  Non-fatal — used by both listBugs and getBug. */
async function selfHealBugFields(ds: DataSource, appSlug: string, bug: IBug): Promise<void> {
  if (bug.priority && bug.bugType) return
  const filePath = path.join(bugsDir(appSlug), bug.feature, `${bug.slug}.md`)
  if (!fs.existsSync(filePath)) return
  const { data } = matter(fs.readFileSync(filePath, 'utf-8'))
  const patch: Partial<IBug> = {}
  if (!bug.priority && data.priority) { bug.priority = String(data.priority); patch.priority = bug.priority }
  if (!bug.bugType && data.bug_type) { bug.bugType = String(data.bug_type); patch.bugType = bug.bugType }
  if (Object.keys(patch).length) {
    try { await ds.getRepository(BugEntity).update(bug.id, patch) } catch { /* non-fatal */ }
  }
}

/** Write-through: keeps markdown files in sync for Copilot agent compatibility. Non-fatal. */
export function writeBugMarkdown(appSlug: string, bug: IBug): void {
  try {
    const filePath = path.join(bugsDir(appSlug), bug.feature, `${bug.slug}.md`)
    // Same field-mapping/fallback logic as the frontmatter->summary sites, fed with
    // IBug fields under their frontmatter names; slug is dropped (not part of BugFrontmatter).
    const summary = summaryFromFrontmatter(
      {
        title: bug.title,
        status: bug.status,
        jira_key: bug.jiraKey,
        reported_at: bug.reportedAt ? bug.reportedAt.toISOString() : null,
        priority: bug.priority,
        bug_type: bug.bugType,
        parent_key: bug.parentKey,
        severity: bug.severity,
        layer: bug.layer,
        jira_status: bug.jiraStatus,
        jira_reporter: bug.jiraReporter,
      },
      bug.slug,
      bug.feature
    )
    const frontmatter: BugFrontmatter = {
      title: summary.title,
      status: summary.status,
      jira_key: summary.jira_key,
      reported_at: summary.reported_at,
      feature: summary.feature,
      priority: summary.priority,
      bug_type: summary.bug_type,
      parent_key: summary.parent_key,
      severity: summary.severity,
      layer: summary.layer,
      jira_status: summary.jira_status,
      jira_reporter: summary.jira_reporter,
    }
    const content = matter.stringify(bug.body ?? '', frontmatter)
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, content, 'utf-8')
  } catch {
    // Non-fatal: markdown write-through failure must not block DB operations
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function listBugs(appSlug: string, module?: string | null): Promise<BugSummary[]> {
  const moduleVal = module !== undefined ? module : null
  try {
    const ds = await getDataSource()
    let qb = ds
      .getRepository(BugEntity)
      .createQueryBuilder('b')
      .select(['b.id', 'b.slug', 'b.feature', 'b.title', 'b.status', 'b.jiraKey', 'b.reportedAt', 'b.priority', 'b.bugType', 'b.parentKey', 'b.severity', 'b.layer', 'b.jiraStatus', 'b.jiraReporter'])
      .where('b.appSlug = :appSlug', { appSlug })
    if (moduleVal === null) {
      qb = qb.andWhere('b.module IS NULL')
    } else if (moduleVal) {
      qb = qb.andWhere('b.module = :module', { module: moduleVal })
    }
    const bugs = await qb.orderBy('b.feature', 'ASC').addOrderBy('b.slug', 'ASC').getMany()
    if (bugs.length === 0) throw new Error('not in DB')
    // Self-heal: sync priority/bugType from markdown for bugs where DB fields are empty
    for (const bug of bugs.filter(b => !b.priority || !b.bugType)) {
      await selfHealBugFields(ds, appSlug, bug)
    }
    return bugs.map(toSummary)
  } catch {
    // Fallback: filesystem only for the root module (null). Prefixed modules need DB.
    if (moduleVal !== null) return []
    const dir = bugsDir(appSlug)
    if (!fs.existsSync(dir)) return []
    const results: BugSummary[] = []
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory())) {
      const featureDir = path.join(dir, entry.name)
      for (const file of fs.readdirSync(featureDir).filter((f) => f.endsWith('.md') && f !== '_template.md')) {
        const slug = file.replace(/\.md$/, '')
        const raw = fs.readFileSync(path.join(featureDir, file), 'utf-8')
        const { data } = matter(raw)
        results.push(summaryFromFrontmatter(data, slug, entry.name))
      }
    }
    return results.sort((a, b) => a.feature.localeCompare(b.feature) || a.slug.localeCompare(b.slug))
  }
}

export async function getBug(
  appSlug: string,
  feature: string,
  slug: string
): Promise<BugDetail | null> {
  try {
    const ds = await getDataSource()
    const bug = await ds.getRepository(BugEntity).findOne({ where: { appSlug, feature, slug } })
    if (bug) {
      // Self-heal: if priority or bugType is empty in DB but the markdown file has values, sync them
      await selfHealBugFields(ds, appSlug, bug)
      return { ...toSummary(bug), body: bug.body }
    }
  } catch {
    // Fall through to filesystem
  }
  // Fallback: filesystem
  const filePath = path.join(bugsDir(appSlug), feature, `${slug}.md`)
  if (!fs.existsSync(filePath)) return null
  const raw = fs.readFileSync(filePath, 'utf-8')
  const { data, content } = matter(raw)
  return { ...summaryFromFrontmatter(data, slug, feature), body: content.trim() }
}

export async function saveBug(
  appSlug: string,
  feature: string,
  slug: string,
  body: string,
  meta: Partial<BugFrontmatter>
): Promise<void> {
  try {
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
        severity: meta.severity ?? existing.severity, layer: meta.layer ?? existing.layer,
        jiraStatus: meta.jira_status !== undefined ? meta.jira_status : existing.jiraStatus,
      }
      await repo.update(existing.id, updated)
      writeBugMarkdown(appSlug, { ...existing, ...updated } as IBug)
    } else {
      const created = await repo.save({ appSlug, feature, slug, body, title: meta.title ?? slug, status: meta.status ?? 'draft', jiraKey: meta.jira_key ?? null, reportedAt: meta.reported_at ? new Date(meta.reported_at) : null, priority: meta.priority ?? '', bugType: meta.bug_type ?? '', parentKey: meta.parent_key ?? null, severity: meta.severity ?? '', layer: meta.layer ?? 'unknown', jiraStatus: meta.jira_status ?? null })
      writeBugMarkdown(appSlug, created)
    }
  } catch (err) {
    console.error('[saveBug] DB save failed, falling back to markdown:', err)
    // DB unavailable — write markdown with what we have as fallback
    const filePath = path.join(bugsDir(appSlug), feature, `${slug}.md`)
    let existing: Partial<BugFrontmatter> = {}
    if (fs.existsSync(filePath)) {
      const { data } = matter(fs.readFileSync(filePath, 'utf-8'))
      existing = data as Partial<BugFrontmatter>
    }
    const fallbackBug: IBug = {
      id: 0, appSlug, feature, slug, body,
      title: meta.title ?? (existing.title as string | undefined) ?? slug,
      status: (meta.status ?? existing.status ?? 'draft') as BugStatus,
      jiraKey: meta.jira_key !== undefined ? meta.jira_key : (existing.jira_key ?? null),
      reportedAt: meta.reported_at !== undefined
        ? (meta.reported_at ? new Date(meta.reported_at) : null)
        : (existing.reported_at ? new Date(existing.reported_at) : null),
      priority: meta.priority ?? existing.priority ?? '',
      bugType: meta.bug_type ?? existing.bug_type ?? '',
      parentKey: meta.parent_key !== undefined ? meta.parent_key : (existing.parent_key ?? null),
      severity: meta.severity ?? existing.severity ?? '',
      layer: meta.layer ?? existing.layer ?? 'unknown',
      jiraStatus: meta.jira_status !== undefined ? meta.jira_status : (existing.jira_status ?? null),
      jiraReporter: existing.jira_reporter ?? null,
    }
    writeBugMarkdown(appSlug, fallbackBug)
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
  let finalSlug = baseSlug
  let counter = 1
  // Determine unique slug using filesystem (works without DB)
  while (fs.existsSync(path.join(bugsDir(appSlug), feature, `${finalSlug}.md`))) {
    finalSlug = `${baseSlug}-${counter++}`
  }
  // Auto-scaffold the feature directory so new features appear in the features list
  const featureDir = path.join(getDataRoot(), appSlug, 'features', feature)
  if (!fs.existsSync(featureDir)) {
    fs.mkdirSync(featureDir, { recursive: true })
  }
  const parentKey = input.parent_key ?? null
  const moduleVal = input.module ?? null
  const bugObj: IBug = { id: 0, appSlug, feature, slug: finalSlug, title: displayTitle, body, status: 'draft', jiraKey: null, reportedAt: null, priority, bugType: bug_type, parentKey, severity, layer, module: moduleVal, jiraStatus: null }
  writeBugMarkdown(appSlug, bugObj)
  try {
    const ds = await getDataSource()
    const repo = ds.getRepository(BugEntity)
    // Refine slug uniqueness against DB as well
    while (await repo.findOne({ where: { appSlug, feature, slug: finalSlug } })) {
      finalSlug = `${baseSlug}-${counter++}`
    }
    const saved = await repo.save({ appSlug, feature, slug: finalSlug, title: displayTitle, body, status: 'draft', jiraKey: null, reportedAt: null, priority, bugType: bug_type, parentKey, severity, layer, module: moduleVal, jiraStatus: null })
    writeBugMarkdown(appSlug, saved as IBug)
  } catch {
    // DB unavailable — markdown write above is sufficient
  }
  return finalSlug
}

export async function changeBugFeature(
  appSlug: string,
  oldFeature: string,
  slug: string,
  newFeature: string
): Promise<void> {
  const oldPath = path.join(bugsDir(appSlug), oldFeature, `${slug}.md`)
  const newPath = path.join(bugsDir(appSlug), newFeature, `${slug}.md`)
  // Move and update markdown file
  if (fs.existsSync(oldPath)) {
    fs.mkdirSync(path.dirname(newPath), { recursive: true })
    const raw = fs.readFileSync(oldPath, 'utf-8')
    const { data, content } = matter(raw)
    data.feature = newFeature
    fs.writeFileSync(newPath, matter.stringify(content, data), 'utf-8')
    try { fs.unlinkSync(oldPath) } catch { /* non-fatal */ }
  }
  // Update DB
  try {
    const ds = await getDataSource()
    await ds.getRepository(BugEntity).update({ appSlug, feature: oldFeature, slug }, { feature: newFeature })
  } catch {
    // DB unavailable — file move above is sufficient
  }
}

export async function getBugStats(
  appSlug: string
): Promise<{ total: number; draft: number; reported: number }> {
  try {
    const ds = await getDataSource()
    const repo = ds.getRepository(BugEntity)
    const [total, draft, reported] = await Promise.all([
      repo.count({ where: { appSlug } }),
      repo.count({ where: { appSlug, status: 'draft' } }),
      repo.count({ where: { appSlug, status: 'reported' } }),
    ])
    if (total === 0) throw new Error('not in DB')
    return { total, draft, reported }
  } catch {
    // Fallback: count from filesystem
    const bugs = await listBugs(appSlug)
    const draft = bugs.filter((b) => b.status === 'draft').length
    const reported = bugs.filter((b) => b.status === 'reported').length
    return { total: bugs.length, draft, reported }
  }
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
  // Always write to filesystem (serves as both fallback and Copilot-agent source)
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
    if (existing) {
      await attachmentRepo.update(existing.id, { data: buffer, mimeType })
    } else {
      await attachmentRepo.save({ bug: { id: bugId }, fileName, mimeType, data: buffer, uploadedAt: new Date() } as unknown as IAttachment)
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
      .addSelect('DATALENGTH(a.data)', 'size')
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
      if (attachment) return { data: attachment.data, mimeType: attachment.mimeType }
    }
  } catch {
    // Fall through to filesystem
  }
  // Fallback: filesystem
  const filePath = path.join(attachmentsDir(appSlug, feature, slug), fileName)
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
  try {
    const ds = await getDataSource()
    const rows = await ds
      .getRepository(BugEntity)
      .createQueryBuilder('b')
      .select('DISTINCT b.feature', 'feature')
      .where('b.appSlug = :appSlug', { appSlug })
      .getRawMany<{ feature: string }>()
    if (rows.length === 0) throw new Error('not in DB')
    return rows.map((r) => r.feature)
  } catch {
    // Fallback: filesystem
    const dir = bugsDir(appSlug)
    if (!fs.existsSync(dir)) return []
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort()
  }
}
