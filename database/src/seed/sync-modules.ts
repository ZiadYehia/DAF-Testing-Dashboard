/**
 * Make the `modules` table match `module.json` on disk: update changed manifests, and drop
 * rows whose manifest is gone.
 *
 * Run with:
 *   npx ts-node database/src/seed/sync-modules.ts --app eptts-web [--dry-run]
 *
 * WHY
 *
 * `db:import` is insert-only, so it does neither half. Edit a module's name, icon or order
 * on disk and nothing changes in the app; delete its directory and the row survives,
 * appearing in the UI as an empty module nobody can explain (reads are DB-first with an FS
 * fallback — `listModules` in src/lib/modules.ts).
 *
 * `src/lib/modules.ts` has `writeModule()` and `deleteModule()`, which do both halves, but
 * they are server-only Next code. This is the equivalent for scripts and generators that
 * write `data/` directly.
 *
 * SAFETY
 *
 * A module row is only dropped when it has NO features pointing at it. `features.module` is
 * a plain string with no foreign key, so deleting a module that is still referenced would
 * leave its features assigned to something that does not exist — present in the database,
 * visible in no module. Those are reported and kept.
 */
import 'reflect-metadata'
import * as fs from 'fs'
import * as path from 'path'
import { AppDataSource } from '../data-source'
import { Module } from '../entities/Module'
import { Feature } from '../entities/Feature'

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

async function main(): Promise<void> {
  await AppDataSource.initialize()
  try {
    const moduleRepo = AppDataSource.getRepository(Module)
    const featureRepo = AppDataSource.getRepository(Feature)

    const modulesRoot = path.join(DATA_ROOT, APP!, 'modules')
    const rows = await moduleRepo.find({ where: { appSlug: APP! } })

    const deleted: string[] = []
    const keptInUse: string[] = []
    const updated: string[] = []

    for (const row of rows) {
      const manifestPath = path.join(modulesRoot, row.slug, 'module.json')

      // ── no manifest: drop the row, unless something still points at it ──────
      if (!fs.existsSync(manifestPath)) {
        const inUse = await featureRepo.count({ where: { appSlug: APP!, module: row.slug } })
        if (inUse > 0) {
          keptInUse.push(`${row.slug} (${inUse} feature(s) still point at it)`)
          continue
        }
        if (!DRY_RUN) await moduleRepo.delete(row.id)
        deleted.push(row.slug)
        continue
      }

      // ── manifest present: push any change into the row ──────────────────────
      let manifest: Record<string, unknown>
      try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
      } catch {
        console.log(`  WARNING: ${row.slug}/module.json is not valid JSON — row left unchanged`)
        continue
      }

      // Same defaulting as listModulesFs / importModules, so a manifest that omits a field
      // does not read as a change on every run.
      const want = {
        name: typeof manifest.name === 'string' ? manifest.name : row.slug,
        icon: typeof manifest.icon === 'string' ? manifest.icon : '',
        sortOrder: typeof manifest.order === 'number' ? manifest.order : 0,
        pathPrefix: typeof manifest.pathPrefix === 'string' ? manifest.pathPrefix : row.slug,
        description: typeof manifest.description === 'string' ? manifest.description : null,
      }

      const changes = Object.entries(want)
        .filter(([k, v]) => (row[k as keyof typeof want] ?? null) !== (v ?? null))
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
      if (changes.length === 0) continue

      if (!DRY_RUN) await moduleRepo.update(row.id, want)
      updated.push(`${row.slug} (${changes.join(', ')})`)
    }

    console.log(
      `${DRY_RUN ? '[dry run] ' : ''}${APP}: ${updated.length} row(s) updated, ` +
      `${deleted.length} dropped${deleted.length ? ` — ${deleted.join(', ')}` : ''}`)
    for (const u of updated) console.log(`    ${u}`)
    if (keptInUse.length) {
      console.log('  KEPT despite having no module.json, because features still reference them:')
      for (const k of keptInUse) console.log(`    ${k}`)
      console.log('  Re-point those features first (sync-feature-modules.ts), then re-run.')
    }
  } finally {
    await AppDataSource.destroy()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
