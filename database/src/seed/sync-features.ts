import 'reflect-metadata'
import * as fs from 'fs'
import * as path from 'path'
import { AppDataSource } from '../data-source'
import { Feature } from '../entities/Feature'
import { TestcaseVersion } from '../entities/TestcaseVersion'

/**
 * Push a feature's AUTHORED CONTENT from disk into the app database.
 *
 * Usage:
 *   npx ts-node database/src/seed/sync-features.ts --app eptts-web --dry-run
 *   npx ts-node database/src/seed/sync-features.ts --app eptts-web
 *   npx ts-node database/src/seed/sync-features.ts --app eptts-web --feature web-information-center
 *
 * WHY THIS IS NEEDED
 *
 * `db:import` is insert-only, and for an EXISTING feature row it fills null columns only
 * (import.ts: "insert-if-missing, else fill null columns only"). `workflow` and `testcases` are
 * never null on a row that was imported once, so they are never refreshed. Rewrite a feature's
 * test-case table on disk and the database keeps the copy it first saw.
 *
 * That is not a silent no-op the way it sounds — it is worse. Reads are DB-first, so the
 * dashboard keeps serving the OLD test cases while `sync-executions` happily writes the NEW
 * case ids into `test_executions`. The result is a page showing yesterday's table with today's
 * verdicts attached to ids that are not in it, and nothing on screen saying the two disagree.
 * That is exactly what happened to `web-information-center`: 31 execution rows against a
 * `features.testcases` column that still held the previous generation's seven cases.
 *
 * WHAT IT OWNS, AND WHAT IT DOES NOT
 *
 * Disk is authoritative for the three authored documents and nothing else:
 *
 *   workflow.md              -> features.workflow
 *   <feature>-testcases.md   -> features.testcases
 *   knowledge.md             -> features.knowledge   (empty file is stored as NULL)
 *   <feature>-testcases-vN.md -> testcase_versions   (per version number)
 *
 * It does NOT touch `jiraKey`, `storyKey`, `module`, `archivedAt` or `lastAddition` — those are
 * owned by the app or by sync-feature-modules, exactly as sync-bugs leaves the reporting fields
 * to the app. `lastModified` is refreshed from the workflow file's mtime so the dashboard's
 * "last modified" column reflects the edit that was just pushed.
 *
 * A feature that has no row yet is REPORTED, not created: creating features is `db:import`'s
 * job, and quietly inserting one here would hide a missing import.
 */

const DATA_ROOT = path.join(__dirname, '..', '..', '..', 'data')

function argValue(flag: string): string | null {
  const i = process.argv.indexOf(flag)
  if (i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) return process.argv[i + 1]
  const inline = process.argv.find((a) => a.startsWith(`${flag}=`))
  return inline ? inline.slice(flag.length + 1) : null
}

const APP = argValue('--app')
const ONLY = argValue('--feature')
const DRY_RUN = process.argv.includes('--dry-run')

if (!APP) {
  console.error('required: --app <slug>')
  process.exit(1)
}

function readOrNull(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null
  return fs.readFileSync(filePath, 'utf-8')
}

/** How many characters differ, roughly — enough to say "this actually changed". */
function describe(before: string | null, after: string | null): string {
  const b = (before ?? '').length
  const a = (after ?? '').length
  return `${b} -> ${a} chars`
}

async function main(): Promise<void> {
  await AppDataSource.initialize()
  const featureRepo = AppDataSource.getRepository(Feature)
  const tvRepo = AppDataSource.getRepository(TestcaseVersion)

  const featuresDir = path.join(DATA_ROOT, APP!, 'features')
  if (!fs.existsSync(featuresDir)) {
    console.error(`no features directory for app "${APP}" at ${featuresDir}`)
    process.exit(1)
  }

  const names = fs.readdirSync(featuresDir)
    .filter((n) => fs.statSync(path.join(featuresDir, n)).isDirectory())
    .filter((n) => !ONLY || n === ONLY)
    .sort()

  if (ONLY && names.length === 0) {
    console.error(`no feature directory named "${ONLY}" under ${featuresDir}`)
    process.exit(1)
  }

  let updated = 0
  let current = 0
  let versionsWritten = 0
  const missingRows: string[] = []

  for (const name of names) {
    const dir = path.join(featuresDir, name)
    const workflow = readOrNull(path.join(dir, 'workflow.md'))
    const testcases = readOrNull(path.join(dir, `${name}-testcases.md`))
    const knowledgeRaw = readOrNull(path.join(dir, 'knowledge.md'))
    const knowledge = knowledgeRaw && knowledgeRaw.trim() ? knowledgeRaw : null

    const feature = await featureRepo.findOne({ where: { appSlug: APP!, name } })
    if (!feature) { missingRows.push(name); continue }

    const changes: string[] = []
    const patch: Partial<Feature> = {}
    if (workflow !== null && workflow !== feature.workflow) {
      patch.workflow = workflow; changes.push(`workflow ${describe(feature.workflow, workflow)}`)
    }
    if (testcases !== null && testcases !== feature.testcases) {
      patch.testcases = testcases; changes.push(`testcases ${describe(feature.testcases, testcases)}`)
    }
    if (knowledge !== feature.knowledge) {
      patch.knowledge = knowledge; changes.push(`knowledge ${describe(feature.knowledge, knowledge)}`)
    }

    if (changes.length > 0) {
      const wfPath = path.join(dir, 'workflow.md')
      if (fs.existsSync(wfPath)) patch.lastModified = fs.statSync(wfPath).mtime
      if (!DRY_RUN) await featureRepo.update(feature.id, patch)
      updated++
      console.log(`  ~ ${DRY_RUN ? 'would update' : 'updated'} ${name}`)
      for (const c of changes) console.log(`      ${c}`)
    } else {
      current++
    }

    // Versioned test-case files. import.ts skips the whole concept once any version exists,
    // so a rewritten -vN file never reaches the app without this.
    const vRe = new RegExp(`^${name}-testcases-v(\\d+)\\.md$`)
    for (const vf of fs.readdirSync(dir).filter((f) => vRe.test(f))) {
      const version = parseInt(vf.match(vRe)![1], 10)
      const content = fs.readFileSync(path.join(dir, vf), 'utf-8')
      const existing = await tvRepo.findOne({
        where: { version, feature: { id: feature.id } }, relations: { feature: true },
      })
      if (!existing) {
        if (!DRY_RUN) await tvRepo.save({ version, content, feature: { id: feature.id } })
        versionsWritten++
        console.log(`  + ${DRY_RUN ? 'would insert' : 'inserted'} ${name} testcases v${version}`)
      } else if (existing.content !== content) {
        if (!DRY_RUN) await tvRepo.update(existing.id, { content })
        versionsWritten++
        console.log(`  ~ ${DRY_RUN ? 'would update' : 'updated'} ${name} testcases v${version} ` +
          `(${describe(existing.content, content)})`)
      }
    }
  }

  console.log(`\n${APP}: ${updated} ${DRY_RUN ? 'to update' : 'updated'}, ` +
    `${current} already current, ${versionsWritten} version file(s) ` +
    `${DRY_RUN ? 'to write' : 'written'}`)

  if (missingRows.length) {
    console.log(`\n${missingRows.length} feature(s) on disk with NO row in the app — run ` +
      'db:import to create them, this tool only updates:')
    for (const m of missingRows) console.log(`   ${m}`)
  }
  if (DRY_RUN) console.log('\n(dry run — nothing written)')

  await AppDataSource.destroy()
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : String(e))
  process.exit(1)
})
