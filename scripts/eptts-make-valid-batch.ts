/**
 * Mint a BATCH of independent VALID commissioning+packing CSVs for manual upload at
 * :8444 /import-jobs. Sibling of scripts/eptts-make-csv.ts, which mints one valid file plus the
 * four REJECT/RETRY rule pairs; this one mints N valid files and nothing else, for when the test
 * is "upload ten files and see ten completed jobs".
 *
 * ONE CHILD PROCESS PER FILE, AND THAT IS THE WHOLE POINT. `lib/eptts-csv` derives the LOT from
 * `runId()`, which is a module-level constant — one process, one lot, no matter how many times
 * buildCommissionPackCsv() is called. Ten files built in one process would therefore share a lot
 * AND a filename, so nine of them would be overwritten on the way out. Re-invoking this script
 * once per file mints a fresh RUN_ID each time, which is what makes each file a genuinely
 * independent identity: own lot, own SGTINs, own SSCC.
 *
 * EVERY FILE IS SINGLE-USE, same as the other generator: byte-identical content is silently
 * deduplicated and the platform returns the EARLIER import job while importing nothing (EPT-007,
 * open). Delete a file once it has been uploaded and run this again.
 *
 * Usage:
 *   npx ts-node scripts/eptts-make-valid-batch.ts
 *   npx ts-node scripts/eptts-make-valid-batch.ts --count 10 --packs 4 --out "C:/somewhere"
 */
import { execFileSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
// The identifiers live in automation-hub/.env (own GLN, company prefix, catalogue GTIN). A
// standalone script has to load it itself; Playwright's config does this for the specs.
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config({ path: path.join(__dirname, '..', 'automation-hub', '.env') })
import { buildCommissionPackCsv } from '../automation-hub/lib/eptts-csv'

const argv = process.argv.slice(2)
const argValue = (flag: string) => {
  const i = argv.indexOf(flag)
  return i >= 0 ? argv[i + 1] : undefined
}

/** Defaults to the Desktop folder the other generator writes to, NOT into the repo. */
const OUT = argValue('--out') ?? path.join(os.homedir(), 'OneDrive', 'Desktop', 'EPTTS-CSVs')
const COUNT = Number(argValue('--count') ?? '10')
const PACKS = Number(argValue('--packs') ?? '4')

interface Built {
  filename: string
  lot: string
  sscc: string
  gln: string
  gtin: string
  sgtins: string[]
  packCount: number
}

/** Child mode: mint exactly one file and report it as JSON on stdout. */
function buildOne(): void {
  const built = buildCommissionPackCsv({ packCount: PACKS })
  fs.mkdirSync(OUT, { recursive: true })
  const filename = `VALID-commission-pack-${built.lot}.csv`
  fs.writeFileSync(path.join(OUT, filename), built.csv, 'utf8')
  const out: Built = {
    filename,
    lot: built.lot,
    sscc: built.sscc,
    gln: built.gln,
    gtin: built.gtin,
    sgtins: built.sgtins,
    packCount: built.packCount,
  }
  process.stdout.write('\n@@JSON@@' + JSON.stringify(out))
}

function spawnChild(): Built {
  const stdout = execFileSync(
    process.execPath,
    [
      '-r',
      'ts-node/register',
      __filename,
      '--one',
      '--out',
      OUT,
      '--packs',
      String(PACKS),
    ],
    {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
      // transpile-only: this script is run repeatedly and a type-check per child is pure latency.
      env: { ...process.env, TS_NODE_TRANSPILE_ONLY: 'true' },
    },
  )
  const marker = stdout.lastIndexOf('@@JSON@@')
  if (marker < 0) throw new Error(`child produced no result:\n${stdout}`)
  return JSON.parse(stdout.slice(marker + '@@JSON@@'.length)) as Built
}

function main(): void {
  if (argv.includes('--one')) return buildOne()

  if (!Number.isInteger(COUNT) || COUNT < 1) throw new Error(`--count must be >= 1, got ${COUNT}`)
  if (!Number.isInteger(PACKS) || PACKS < 1) throw new Error(`--packs must be >= 1, got ${PACKS}`)

  fs.mkdirSync(OUT, { recursive: true })
  console.log(`writing ${COUNT} valid files (${PACKS} packs each) to ${OUT}\n`)

  const files: Built[] = []
  for (let i = 1; i <= COUNT; i++) {
    const built = spawnChild()
    files.push(built)
    console.log(
      `  ${String(i).padStart(2, '0')}/${COUNT}  ${built.filename}` +
        `   lot ${built.lot}  SSCC ${built.sscc}`,
    )
  }

  // A repeated lot or SSCC would mean two files carrying one identity, which is exactly the
  // dedup trap this script exists to avoid. Cheap to assert, expensive to discover on the
  // platform as "the import succeeded but nothing was created".
  const dupe = (label: string, values: string[]) => {
    const seen = new Set<string>()
    for (const v of values) {
      if (seen.has(v)) throw new Error(`duplicate ${label} across files: ${v} — do not upload these`)
      seen.add(v)
    }
  }
  dupe('lot', files.map((f) => f.lot))
  dupe('SSCC', files.map((f) => f.sscc))
  dupe('SGTIN', files.flatMap((f) => f.sgtins))

  const { gln, gtin } = files[0]
  const readme = `EPTTS valid commissioning + packing CSVs — batch of ${files.length}
=================================================================
Generated ${new Date().toISOString()} for GLN ${gln}, GTIN ${gtin}.

WHAT THESE ARE
--------------
${files.length} independent VALID files, ${PACKS} packs each. Every file has its own lot, its own
SGTINs and its own SSCC, so they can be uploaded in any order and each import job should reach
"completed" with ${PACKS} packs commissioned and 1 aggregation created.

    file                                             lot                    SSCC
${files
  .map((f) => `    ${f.filename.padEnd(48)} ${f.lot.padEnd(22)} ${f.sscc}`)
  .join('\n')}

EVERY FILE IS SINGLE-USE
------------------------
Uploading byte-identical content a second time is silently DEDUPLICATED: the platform returns the
earlier import job and imports nothing, while appearing to succeed. Delete each file once you have
uploaded it, then generate a fresh batch.

WHERE TO UPLOAD
---------------
https://192.168.225.195:8444/import-jobs  (Citrix VPN required), signed in as the manufacturer
that owns GLN ${gln}. Every row's readPointGLN and bizLocationGLN must equal your own entity GLN
and the GTIN must be one your company owns — the most common reason a file is refused.

HOW TO MAKE MORE
----------------
From the repo root (${path.join(__dirname, '..')}):

    npx ts-node scripts/eptts-make-valid-batch.ts --count ${files.length} --packs ${PACKS}

For the rule-coverage set instead (1 valid + 4 REJECT/RETRY pairs), see README.txt and
scripts/eptts-make-csv.ts.
`
  fs.writeFileSync(path.join(OUT, 'README-VALID-BATCH.txt'), readme, 'utf8')

  console.log(`\nwrote README-VALID-BATCH.txt alongside the CSVs`)
  console.log(
    'Each file is SINGLE-USE: identical content is deduplicated and imports nothing (EPT-007).',
  )
}

main()
