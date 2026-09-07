/**
 * Make the `bugs` table match the bug markdown on disk: update changed bodies, titles and
 * frontmatter fields.
 *
 * Run with:
 *   npx ts-node database/src/seed/sync-bugs.ts --app eptts-api [--dry-run]
 *
 * WHY
 *
 * `db:import` is insert-only for bugs, and says so at import.ts: "never clobber a row that
 * may have been edited through the app". That is the right default — someone editing a bug
 * in the UI should not have it overwritten by a stale file — but it means a bug edited ON
 * DISK never reaches the app at all. Reads are DB-first (`getBug` in src/lib/bugs.ts serves
 * `bug.body` straight from the row), so the dashboard keeps showing the old text and there is
 * nothing on screen to suggest the file and the row disagree.
 *
 * That is not hypothetical: request/response evidence was added to all ten eptts-api bug
 * files and none of it appeared in the dashboard, because every one of those bugs already had
 * a row. The files were right, the app was showing something else, and `db:import` reported
 * success both times.
 *
 * FIELD OWNERSHIP — the point of the whole tool
 *
 * Disk and the app each own different fields, and syncing everything from disk destroys data.
 * This is not theoretical: DW-958 (the re-commissioning bug) had been reported to Jira
 * THROUGH THE APP, so its row held status "reported", jiraKey DW-958, a reportedAt timestamp
 * and the Jira reporter id, while the file still said `status: draft` / `jira_key: null`
 * because nothing writes those back to disk. A naive file-wins sync resets the bug to draft
 * and throws away the Jira link.
 *
 *   DISK owns the authored content — title, body, priority, bugType, severity, layer,
 *   parentKey. These are what a person edits in the markdown, and what this tool updates.
 *
 *   THE APP owns the reporting workflow — status, jiraKey, reportedAt, jiraStatus,
 *   jiraReporter. Set when a bug is filed from the UI, never written back to the file, so the
 *   file's copy is stale by construction. NEVER written from disk; disagreements are reported
 *   so it is clear the file is the out-of-date one.
 *
 * It never deletes a row — a file removed from disk may well have been filed in Jira. Those are
 * reported instead.
 *
 * MODULE AND ATTACHMENTS ARE OWNED HERE TOO, and that is a correction.
 *
 * `bugs.module` is derived from the bug's feature (features/<feature>/metadata.json), exactly as
 * import.ts resolves it. It used to be left alone on the grounds that sync-feature-modules owned
 * it — but that tool assigns modules to FEATURES and never touches a bug row. The result was that
 * every bug this tool inserted carried module NULL and never appeared under its module in the
 * dashboard: twelve filed bugs were invisible while the seven that predated them, inserted by
 * db:import, showed up fine.
 *
 * Attachments have the same shape of problem. import.ts registers them, but it is insert-only for
 * bugs and is not re-run after a bug is filed, so evidence added later never reaches the app and
 * the report renders with no screenshots. Rows carry `data: null` — the binary is served from
 * disk — so this only registers filename, MIME type and size.
 */
import 'reflect-metadata'
import * as fs from 'fs'
import * as path from 'path'
import matter from 'gray-matter'
import { AppDataSource } from '../data-source'
import { Bug } from '../entities/Bug'
import { Attachment } from '../entities/Attachment'

const DATA_ROOT = path.join(__dirname, '..', '..', '..', 'data')

function argValue(flag: string): string | null {
  const i = process.argv.indexOf(flag)
  if (i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) return process.argv[i + 1]
  const inline = process.argv.find((a) => a.startsWith(`${flag}=`))
  return inline ? inline.slice(flag.length + 1) : null
}

const APP = argValue('--app')
const DRY_RUN = process.argv.includes('--dry-run')

if (!APP) {
  console.error('required: --app <slug>')
  process.exit(1)
}

/** Mirrors src/lib/bugs.ts and import.ts — keep the three in step. */
const ATTACHMENT_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
}

/** The module a bug belongs to, taken from its feature. Same resolution as import.ts. */
function resolveBugModule(appSlug: string, feature: string): string | null {
  const metaFile = path.join(DATA_ROOT, appSlug, 'features', feature, 'metadata.json')
  if (!fs.existsSync(metaFile)) return null
  try {
    return (JSON.parse(fs.readFileSync(metaFile, 'utf-8')) as { module?: string | null }).module ?? null
  } catch {
    return null
  }
}

/**
 * Register the evidence files sitting in <slug>-attachments/ against a bug row.
 *
 * `data` stays null: the dashboard streams the binary from disk, so storing it twice would
 * bloat the database for nothing. Returns how many rows were added.
 */
async function syncAttachments(appSlug: string, bugId: number, feature: string, slug: string,
                               dryRun: boolean): Promise<string[]> {
  const dir = path.join(DATA_ROOT, appSlug, 'bugs', feature, `${slug}-attachments`)
  if (!fs.existsSync(dir)) return []
  const repo = AppDataSource.getRepository(Attachment)
  const added: string[] = []
  for (const fileName of fs.readdirSync(dir).sort()) {
    const ext = path.extname(fileName).toLowerCase()
    if (!ATTACHMENT_MIME[ext]) continue
    const existing = await repo.findOne({ where: { bug: { id: bugId }, fileName } })
    if (existing) continue
    if (!dryRun) {
      await repo.save({
        bug: { id: bugId },
        fileName,
        mimeType: ATTACHMENT_MIME[ext],
        data: null,
        byteSize: (() => { try { return fs.statSync(path.join(dir, fileName)).size } catch { return null } })(),
      })
    }
    added.push(fileName)
  }
  return added
}

/** Authored content: disk wins, this tool writes it. */
function diskOwned(filePath: string): Partial<Bug> & { body: string } {
  const { data, content } = matter(fs.readFileSync(filePath, 'utf-8'))
  return {
    title: data.title ?? path.basename(filePath, '.md'),
    priority: data.priority ?? '',
    bugType: data.bug_type ?? '',
    parentKey: data.parent_key ?? null,
    severity: data.severity ?? '',
    layer: data.layer ?? 'unknown',
    // Disk-owned like the rest of the authored metadata: which environment a bug was found on is
    // a fact about the investigation, decided when the report is written, and nothing in the app
    // edits it. Absent from the frontmatter means not attributed to one.
    environment: data.environment ?? null,
    body: content.trim(),
  }
}

/**
 * Reporting workflow: the app wins, this tool never writes it. Read only so a disagreement
 * can be reported — the file is the stale copy, since nothing writes these back to disk.
 */
function appOwned(filePath: string): Partial<Bug> {
  const { data } = matter(fs.readFileSync(filePath, 'utf-8'))
  return {
    status: data.status ?? 'draft',
    jiraKey: data.jira_key ?? null,
    reportedAt: data.reported_at ? new Date(data.reported_at) : null,
    jiraStatus: data.jira_status ?? null,
    jiraReporter: data.jira_reporter ?? null,
  }
}

const sameDate = (a: Date | null | undefined, b: Date | null | undefined): boolean =>
  (a ? a.getTime() : null) === (b ? b.getTime() : null)

async function main(): Promise<void> {
  await AppDataSource.initialize()
  try {
    const repo = AppDataSource.getRepository(Bug)
    const root = path.join(DATA_ROOT, APP!, 'bugs')
    if (!fs.existsSync(root)) {
      console.log(`no bugs directory for ${APP}`)
      return
    }

    const onDisk = new Set<string>()
    let updated = 0
    let inserted = 0
  let attachmentsAdded = 0
    let current = 0
    const staleFrontmatter: string[] = []

    for (const entry of fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory())) {
      const feature = entry.name
      const featureDir = path.join(root, feature)

      for (const file of fs.readdirSync(featureDir)
        .filter((f) => f.endsWith('.md') && f !== '_template.md')) {
        const slug = file.replace(/\.md$/, '')
        onDisk.add(`${feature}/${slug}`)
        const filePath = path.join(featureDir, file)
        const fields = diskOwned(filePath)
        const existing = await repo.findOne({ where: { appSlug: APP!, feature, slug } })

        const moduleVal = resolveBugModule(APP!, feature)

        if (!existing) {
          // A brand-new bug has no app-side history yet, so the file's workflow fields are
          // all there is — take them on insert only.
          let newId: number | undefined
          if (!DRY_RUN) {
            const saved = await repo.save({
              appSlug: APP!, feature, slug, module: moduleVal, ...fields, ...appOwned(filePath),
            })
            newId = saved.id
          }
          inserted++
          console.log(`  + insert   ${feature}/${slug.slice(0, 50)}`)
          if (newId !== undefined) {
            const files = await syncAttachments(APP!, newId, feature, slug, DRY_RUN)
            if (files.length) {
              attachmentsAdded += files.length
              console.log(`      + ${files.length} attachment(s): ${files.join(', ')}`)
            }
          }
          continue
        }

        // Report, never write. If the row says reported/DW-958 and the file says draft/null,
        // the ROW is right — reporting happens in the app and is not written back to disk.
        const fileWorkflow = appOwned(filePath)
        const workflowDiffs = (Object.keys(fileWorkflow) as (keyof Bug)[]).filter((k) => {
          const a = fileWorkflow[k] as unknown
          const b = existing[k] as unknown
          return a instanceof Date || b instanceof Date
            ? !sameDate(a as Date | null, b as Date | null)
            : (a ?? null) !== (b ?? null)
        })
        if (workflowDiffs.length) {
          staleFrontmatter.push(`${feature}/${slug.slice(0, 46)} — app has ` +
            `${workflowDiffs.map((k) => `${String(k)}=${String(existing[k] ?? 'null')}`).join(', ')}`)
        }

        // Report WHICH fields differ — "updated 10 bugs" tells nobody whether the right
        // thing changed, and body is the field most likely to be the one that matters.
        const changes: string[] = []
        for (const [key, value] of Object.entries(fields) as [keyof Bug, unknown][]) {
          const before = existing[key] as unknown
          const differs = value instanceof Date || before instanceof Date
            ? !sameDate(value as Date | null, before as Date | null)
            : (before ?? null) !== (value ?? null)
          if (!differs) continue
          changes.push(key === 'body'
            ? `body ${String(before ?? '').length} -> ${String(value).length} chars`
            : String(key))
        }

        // module is derived, not authored — backfill it whenever the row disagrees with disk.
        if ((existing.module ?? null) !== moduleVal) {
          changes.push(`module ${existing.module ?? 'NULL'} -> ${moduleVal ?? 'NULL'}`)
        }

        // Evidence can be added to a bug long after it is filed, so check every time.
        const newFiles = await syncAttachments(APP!, existing.id, feature, slug, DRY_RUN)
        if (newFiles.length) {
          attachmentsAdded += newFiles.length
          console.log(`  + ${DRY_RUN ? 'would attach' : 'attached'} ${feature}/${slug.slice(0, 40)}`)
          console.log(`      ${newFiles.length} file(s): ${newFiles.join(', ')}`)
        }

        if (!changes.length) { current++; continue }
        if (!DRY_RUN) await repo.save({ ...existing, ...fields, module: moduleVal })
        updated++
        console.log(`  ~ ${DRY_RUN ? 'would update' : 'updated'} ${feature}/${slug.slice(0, 44)}`)
        console.log(`      ${changes.join(', ')}`)
      }
    }

    // Rows with no file. Never deleted: a bug may have been filed in Jira from the app, and
    // losing it because a file was renamed would be a silent data loss.
    const orphans = (await repo.find({ where: { appSlug: APP! } }))
      .filter((r) => !onDisk.has(`${r.feature}/${r.slug}`))

    console.log(`\n${APP}: ${updated} ${DRY_RUN ? 'to update' : 'updated'}, ` +
      `${inserted} ${DRY_RUN ? 'to insert' : 'inserted'}, ${current} already current`)

    if (orphans.length) {
      console.log(`\n${orphans.length} row(s) with no file on disk — KEPT, not deleted:`)
      for (const o of orphans) console.log(`   ${o.feature}/${o.slug.slice(0, 60)}`)
    }
    if (staleFrontmatter.length) {
      console.log(`\n${staleFrontmatter.length} bug(s) whose FILE frontmatter is behind the ` +
        'app on reporting fields — left alone, the app is authoritative for these:')
      for (const s of staleFrontmatter) console.log(`   ${s}`)
    }
    if (DRY_RUN) console.log('\n(dry run — nothing written)')
  } finally {
    await AppDataSource.destroy()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
