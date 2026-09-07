/**
 * Read back what the dashboard will actually SHOW for a set of bugs and test cases.
 *
 * Every ingestion path here has a different overwrite rule — `db:import` is insert-only for
 * bugs and executions, `sync-bugs` overwrites authored fields, `sync-executions` overwrites
 * status and notes, and automation projects are not in the database at all — so "I ran the
 * import" is not evidence that the screen changed. This asks the database the same questions
 * the app asks it.
 *
 * Read-only. Run with:
 *   npx ts-node database/src/seed/verify-dashboard-state.ts --app eptts-api
 */
import 'reflect-metadata'
import * as fs from 'fs'
import * as path from 'path'
import { AppDataSource } from '../data-source'
import { Bug } from '../entities/Bug'
import { Attachment } from '../entities/Attachment'
import { TestExecution } from '../entities/TestExecution'

const appIdx = process.argv.indexOf('--app')
const APP = appIdx !== -1 ? process.argv[appIdx + 1] : 'eptts-api'
const REPO = path.resolve(__dirname, '..', '..', '..')

async function main(): Promise<void> {
  await AppDataSource.initialize()

  const bugRepo = AppDataSource.getRepository(Bug)
  const attRepo = AppDataSource.getRepository(Attachment)
  const execRepo = AppDataSource.getRepository(TestExecution)

  console.log(`\n── BUGS (${APP}) ──`)
  const bugs = await bugRepo.find({ where: { appSlug: APP }, order: { feature: 'ASC', slug: 'ASC' } })
  for (const b of bugs) {
    const atts = await attRepo.count({ where: { bug: { id: b.id } } })
    const file = path.join(REPO, 'data', APP, 'bugs', b.feature, `${b.slug}.md`)
    const onDisk = fs.existsSync(file)
    console.log(
      `  ${b.feature.padEnd(22)} ${String(b.slug).slice(0, 46).padEnd(48)} ` +
      `body=${String(b.body ?? '').length.toString().padStart(5)}  att=${String(atts).padStart(2)}  ` +
      `env=${(b.environment ?? '-').padEnd(12)} ${b.status.padEnd(9)} ${onDisk ? '' : ' (NO FILE)'}`,
    )
  }

  console.log(`\n── EXECUTIONS for the cases touched this session ──`)
  const ids = ['TC_DISP_001', 'TC_DISP_003', 'TC_DISP_010', 'TC_DISP_030', 'TS_RTRV_003', 'TC_DEST_001']
  for (const id of ids) {
    const rows = await execRepo.find({ where: { testcaseId: id, feature: { appSlug: APP } }, relations: { feature: true } })
    if (!rows.length) { console.log(`  ${id.padEnd(13)} (no row)`); continue }
    for (const r of rows) {
      const note = (r.notes ?? '').replace(/\s+/g, ' ').slice(0, 84)
      console.log(`  ${id.padEnd(13)} env=${(r.environment ?? '-').padEnd(12)} ${String(r.status).padEnd(8)} ${note}`)
    }
  }

  console.log(`\n── AUTOMATION (filesystem, not database) ──`)
  const projRoot = path.join(REPO, 'automation-hub', 'projects')
  const journeys = fs.readdirSync(projRoot).filter((n) => n.includes('e2e') || n.endsWith('smoke'))
  for (const name of journeys) {
    const metaPath = path.join(projRoot, name, 'meta.json')
    if (!fs.existsSync(metaPath)) { console.log(`  ${name} (no meta.json — INVISIBLE to the Hub)`); continue }
    const m = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
    const spec = fs.existsSync(path.join(projRoot, name, 'test.spec.ts'))
    console.log(
      `  ${name.padEnd(28)} app=${String(m.app).padEnd(11)} engine=${String(m.engine).padEnd(4)} ` +
      `folder="${m.folder}" runs=${(m.runs ?? []).length} last=${m.lastStatus ?? '-'}` +
      `${spec ? '' : '  (NO SPEC)'}`,
    )
  }

  await AppDataSource.destroy()
}

main().catch((e) => { console.error(e); process.exit(1) })
