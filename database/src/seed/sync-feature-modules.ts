/**
 * Push each feature's module assignment from metadata.json INTO the database, overwriting.
 *
 * Run with:
 *   npx ts-node database/src/seed/sync-feature-modules.ts --app eptts-web [--dry-run]
 *
 * WHY THIS EXISTS SEPARATELY FROM db:import
 *
 * `import.ts` fills a NULL module but never replaces one that is already set:
 *
 *     if (feature.module == null && moduleVal) fill.module = moduleVal
 *
 * That is the right default for a backfill — it cannot clobber a human's choice — and it
 * means re-organising an app's module tree on disk has no effect on the database at all.
 * The UI groups features by the DB column, so the files and the app disagree until this runs.
 *
 * Like sync-executions.ts, this OVERWRITES, which is why it takes a required `--app` and is
 * not wired into any npm alias.
 *
 * IT ALSO FIXES THE BUGS, WHICH IS EASY TO FORGET
 *
 * `bugs.module` is set once when the bug is filed and never re-derived. Move a feature to a
 * different module and its bugs stay listed under the old one — present in the database,
 * invisible on the page anyone would look at. So this syncs those too.
 *
 * One subtlety worth stating: `bugs.module` holds the module's **pathPrefix**, not its slug
 * (see resolveBugModule in import.ts). They happen to be equal for every eptts-web module,
 * but the root module of an app has `pathPrefix: ''` which maps to NULL — so this resolves
 * through module.json rather than assuming slug === pathPrefix.
 */
import 'reflect-metadata'
import * as fs from 'fs'
import * as path from 'path'
import { AppDataSource } from '../data-source'
import { Feature } from '../entities/Feature'
import { Bug } from '../entities/Bug'
import { Module } from '../entities/Module'

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
  console.error('required: --app <slug>   (this OVERWRITES features.module and bugs.module for that app)')
  process.exit(1)
}

function readModuleOf(featureDir: string): string | null {
  try {
    const meta = JSON.parse(fs.readFileSync(path.join(featureDir, 'metadata.json'), 'utf8'))
    return typeof meta.module === 'string' && meta.module ? meta.module : null
  } catch {
    return null
  }
}

async function main(): Promise<void> {
  await AppDataSource.initialize()
  try {
    const featureRepo = AppDataSource.getRepository(Feature)
    const bugRepo = AppDataSource.getRepository(Bug)
    const moduleRepo = AppDataSource.getRepository(Module)

    const featuresRoot = path.join(DATA_ROOT, APP!, 'features')
    if (!fs.existsSync(featuresRoot)) {
      console.error(`no features directory for "${APP}" at ${featuresRoot}`)
      process.exitCode = 1
      return
    }

    // slug -> pathPrefix, for the bugs half. '' is a legitimate value (the root module).
    const prefixOf = new Map<string, string | null>()
    for (const m of await moduleRepo.find({ where: { appSlug: APP! } })) {
      prefixOf.set(m.slug, m.pathPrefix === '' ? null : m.pathPrefix)
    }

    let featuresUpdated = 0
    let featuresCurrent = 0
    let bugsUpdated = 0
    const noRow: string[] = []
    const unknownModule = new Set<string>()

    for (const name of fs.readdirSync(featuresRoot)) {
      const dir = path.join(featuresRoot, name)
      if (!fs.statSync(dir).isDirectory()) continue

      const wanted = readModuleOf(dir)
      if (wanted === null) continue          // no metadata.json — leave the DB alone

      if (!prefixOf.has(wanted)) unknownModule.add(wanted)

      const row = await featureRepo.findOne({ where: { appSlug: APP!, name } })
      if (!row) { noRow.push(name); continue }

      if (row.module !== wanted) {
        if (!DRY_RUN) await featureRepo.update(row.id, { module: wanted })
        featuresUpdated++
      } else {
        featuresCurrent++
      }

      // Bugs follow their feature. `feature` is a plain string column, not an FK.
      const wantedPrefix = prefixOf.has(wanted) ? prefixOf.get(wanted)! : wanted
      const bugs = await bugRepo.find({ where: { appSlug: APP!, feature: name } })
      for (const b of bugs) {
        if ((b.module ?? null) === (wantedPrefix ?? null)) continue
        if (!DRY_RUN) await bugRepo.update(b.id, { module: wantedPrefix })
        bugsUpdated++
      }
    }

    console.log(
      `${DRY_RUN ? '[dry run] ' : ''}${APP}: ${featuresUpdated} feature(s) re-pointed, ` +
      `${featuresCurrent} already current, ${bugsUpdated} bug(s) re-pointed`,
    )
    if (unknownModule.size) {
      // Not fatal — `features.module` has no FK, so a typo silently produces a feature that
      // belongs to a module that does not exist and therefore appears nowhere.
      console.log(`  WARNING: metadata.json references module(s) with no module.json: ${[...unknownModule].join(', ')}`)
    }
    if (noRow.length) {
      console.log(`  ${noRow.length} feature dir(s) with no DB row (run npm run db:import first): ${noRow.slice(0, 8).join(', ')}`)
    }
  } finally {
    await AppDataSource.destroy()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
