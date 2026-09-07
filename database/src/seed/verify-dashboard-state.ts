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
  // Soft-deleted rows are excluded, because the dashboard excludes them: a retracted report
  // must not still read as an open defect here.
  const bugs = (await bugRepo.find({ where: { appSlug: APP }, order: { feature: 'ASC', slug: 'ASC' } }))
    .filter((b) => !b.deletedAt)
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
  const ids = process.argv.includes('--cases')
    ? String(process.argv[process.argv.indexOf('--cases') + 1]).split(',')
    : ['TC_DISP_001', 'TC_DISP_030', 'TC_DISP_035', 'TC_DISP_036', 'TC_DISP_037',
       'TC_PDISP_037', 'TS_RTRV_003', 'TC_DEST_001']
  for (const id of ids) {
    const rows = await execRepo.find({ where: { testcaseId: id, feature: { appSlug: APP } }, relations: { feature: true } })
    if (!rows.length) { console.log(`  ${id.padEnd(13)} (no row)`); continue }
    for (const r of rows) {
      const note = (r.notes ?? '').replace(/\s+/g, ' ').slice(0, 84)
      console.log(`  ${id.padEnd(13)} env=${(r.environment ?? '-').padEnd(12)} ${String(r.status).padEnd(8)} ${note}`)
    }
  }

  // Parity between the devsim status files and the rows the dashboard serves. Worth checking
  // explicitly: the case extractor used to OVERWRITE execution-status-v1.json from the source
  // spreadsheet, so regenerating cases could quietly replace measured results with staging-era
  // values, and comparing was the only way to notice.
  console.log(`\n── DEVSIM STATUS PARITY (file vs database) ──`)
  const featuresDir = path.join(REPO, 'data', APP, 'features')
  let checked = 0
  const mismatches: string[] = []
  for (const feature of fs.readdirSync(featuresDir)) {
    const statusFile = path.join(featuresDir, feature, 'execution-status-v1.json')
    if (!fs.existsSync(statusFile)) continue
    const wanted = JSON.parse(fs.readFileSync(statusFile, 'utf-8')) as Record<string, string>
    const rows = await execRepo.find({
      where: { feature: { appSlug: APP, name: feature } }, relations: { feature: true },
    })
    for (const [id, want] of Object.entries(wanted)) {
      checked++
      const row = rows.find((r) => r.testcaseId === id && (r.environment ?? null) === null)
      if (!row) { mismatches.push(`${feature}/${id}: file=${want} db=(no row)`); continue }
      if (row.status !== want) mismatches.push(`${feature}/${id}: file=${want} db=${row.status}`)
    }
  }
  console.log(`  rows checked: ${checked}`)
  if (mismatches.length === 0) {
    console.log('  PARITY OK — every devsim status matches its file')
  } else {
    console.log(`  MISMATCHES (${mismatches.length}):`)
    for (const m of mismatches.slice(0, 20)) console.log(`    ${m}`)
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
