/**
 * Soft-delete a bug row whose markdown file has been withdrawn.
 *
 * `sync-bugs` deliberately never deletes — "a file removed from disk may well have been filed
 * in Jira" — so it reports an orphan row and leaves it, which is right as a default. But a
 * report that turns out to be WRONG has to come off the dashboard, or it keeps asserting a
 * defect the platform does not have. This is the explicit, one-at-a-time counterpart.
 *
 * Soft, not hard: `bugs.deletedAt` exists, the app filters on it, and keeping the row means a
 * retraction stays auditable instead of the record simply vanishing.
 *
 * Refuses to touch a row that carries a Jira key — once it is filed, withdrawing it is a
 * conversation on the board, not a database write.
 *
 * Usage:
 *   npx ts-node database/src/seed/delete-bug.ts --app eptts-api --feature api-dispensing \
 *     --slug <slug> --reason "why" [--write]
 */
import 'reflect-metadata'
import { AppDataSource } from '../data-source'
import { Bug } from '../entities/Bug'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 ? process.argv[i + 1] : undefined
}

const appSlug = arg('app')
const feature = arg('feature')
const slug = arg('slug')
const reason = arg('reason') ?? ''
const WRITE = process.argv.includes('--write')

async function main(): Promise<void> {
  if (!appSlug || !feature || !slug) {
    console.error('usage: --app <slug> --feature <feature> --slug <slug> --reason "..." [--write]')
    process.exit(1)
  }
  await AppDataSource.initialize()
  const repo = AppDataSource.getRepository(Bug)
  const row = await repo.findOne({ where: { appSlug, feature, slug } })

  if (!row) {
    console.log(`no row for ${appSlug}/${feature}/${slug} — nothing to do`)
  } else if (row.jiraKey) {
    console.log(`REFUSING: ${slug} carries ${row.jiraKey}. Withdraw it on the board, not here.`)
  } else if (row.deletedAt) {
    console.log(`${slug} is already soft-deleted (${row.deletedAt.toISOString()})`)
  } else if (!WRITE) {
    console.log(`would soft-delete row ${row.id} "${String(row.title).slice(0, 70)}"`)
    console.log(`  reason: ${reason || '(none given)'}`)
    console.log('  (dry run — pass --write)')
  } else {
    row.deletedAt = new Date()
    await repo.save(row)
    console.log(`soft-deleted row ${row.id} — ${reason || '(no reason given)'}`)
  }
  await AppDataSource.destroy()
}

main().catch((e) => { console.error(e); process.exit(1) })
