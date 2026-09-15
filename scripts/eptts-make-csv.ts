/**
 * Mint commissioning-and-packing CSVs for manual upload at :8444 /import-jobs.
 *
 * WHY THIS EXISTS. `automation-hub/lib/eptts-csv.ts` builds these per run into the OS temp
 * directory, which is right for a spec and useless for a person: the file is thrown away and the
 * path is unguessable. This writes the same fixtures to a folder you can open, and prints what is
 * inside each one so a manual upload can be checked against what it was supposed to contain.
 *
 * EVERY FILE IS SINGLE-USE. Re-uploading byte-identical content is silently DEDUPLICATED — the
 * platform returns the earlier import job and imports nothing (filed as EPT-007, still open). A
 * second upload of the same file therefore looks like it worked and did nothing at all, which is
 * the worst possible outcome for a manual test. Run this again for a fresh set; every run mints
 * new SSCCs, SGTINs and a new lot.
 *
 * Usage:
 *   npx ts-node scripts/eptts-make-csv.ts
 *   npx ts-node scripts/eptts-make-csv.ts --out "C:/somewhere/else" --packs 4
 */
import fs from 'fs'
import os from 'os'
import path from 'path'
// The identifiers come from automation-hub/.env (own GLN, GCP length, catalogue GTIN). Playwright
// loads that file through its config; a standalone script has to ask for it, or every build fails
// on "Missing environment variable EPTTS_WEB_MFG_GLN".
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config({ path: path.join(__dirname, '..', 'automation-hub', '.env') })
import {
  buildCommissionPackCsv,
  buildCommissionPackCsvPair,
  CSV_COLUMNS,
  type CsvFault,
} from '../automation-hub/lib/eptts-csv'

const argv = process.argv.slice(2)
const argValue = (flag: string) => {
  const i = argv.indexOf(flag)
  return i >= 0 ? argv[i + 1] : undefined
}

/**
 * Defaults to the Desktop, NOT into the repo.
 *
 * These are single-use throwaways — every run mints new SGTINs and SSCCs, and a file that has
 * been uploaded once is dead (see the dedup note above). Committing them would add generated
 * files that are stale the moment they are used, so they belong somewhere you can find and
 * delete. `os.homedir()` rather than a hardcoded path so this still works for anyone else.
 */
const OUT = argValue('--out') ?? path.join(os.homedir(), 'OneDrive', 'Desktop', 'EPTTS-CSVs')
const PACKS = Number(argValue('--packs') ?? '4')

/**
 * One valid file, plus one file per rule the importer enforces.
 *
 * The faulted files come from `buildCommissionPackCsvPair`, which renders ONE identity twice —
 * once broken, once correct. That matters for a manual test: uploading the faulted file and then
 * the corrected one proves the file was rejected for the RULE and not for anything about the
 * identifiers, because the identifiers are the same in both.
 */
const FAULTS: { fault: CsvFault; explains: string }[] = [
  { fault: 'badImportFlag', explains: "import column set to 'yes'; only I, L, 1 or 0 are accepted" },
  { fault: 'seqNoGap', explains: 'seqNo jumps, breaking the ascending-with-no-gaps rule' },
  { fault: 'mismatchedGlns', explains: 'readPointGLN and bizLocationGLN differ from each other' },
  { fault: 'overlongLot', explains: 'lot of 21 characters, over the GS1 AI 10 limit of 20' },
]

function save(filename: string, csv: string): string {
  const target = path.join(OUT, filename)
  fs.writeFileSync(target, csv, 'utf8')
  return target
}

function main() {
  fs.mkdirSync(OUT, { recursive: true })

  console.log(`writing to ${OUT}\n`)

  const valid = buildCommissionPackCsv({ packCount: PACKS })
  const validPath = save(`VALID-commission-pack-${valid.lot}.csv`, valid.csv)
  console.log('VALID — expect the import job to reach "completed"')
  console.log(`  file   ${path.basename(validPath)}`)
  console.log(`  GLN    ${valid.gln}   (must equal your own entity GLN)`)
  console.log(`  GTIN   ${valid.gtin}`)
  console.log(`  lot    ${valid.lot}`)
  console.log(`  SSCC   ${valid.sscc}   (${valid.packCount} packs aggregated into it)`)
  console.log(`  SGTINs ${valid.sgtins.length}`)
  console.log('\n  contents:')
  for (const line of valid.csv.trimEnd().split('\n')) console.log('    ' + line)

  console.log('\nREJECTED — each is one rule, and the whole file must be refused, not just the row')
  for (const { fault, explains } of FAULTS) {
    const pair = buildCommissionPackCsvPair(fault, { packCount: PACKS })
    const bad = save(`REJECT-${fault}-${pair.faulted.lot}.csv`, pair.faulted.csv)
    const good = save(`RETRY-${fault}-${pair.corrected.lot}.csv`, pair.corrected.csv)
    console.log(`  ${fault}`)
    console.log(`    why      ${explains}`)
    console.log(`    bad row  ${pair.faulted.faultRow ?? '(n/a)'}`)
    console.log(`    upload   ${path.basename(bad)}   -> expect the whole file refused`)
    console.log(`    then     ${path.basename(good)}   -> same identifiers, rule fixed; expect completed`)
  }

  // The instructions travel WITH the files. A folder of CSVs on a desktop, a week later, is
  // unusable without knowing which one is meant to fail and why — and single-use files that look
  // reusable are worse than no files.
  const readme = `EPTTS commissioning + packing CSVs
==================================
Generated ${new Date().toISOString()} for GLN ${valid.gln}, GTIN ${valid.gtin}, lot ${valid.lot}.

HOW TO MAKE MORE
----------------
From the repo root (${process.cwd()}):

    npx ts-node scripts/eptts-make-csv.ts

Options:
    --packs 10                 how many packs to commission and aggregate (default 4)
    --out "D:/some/folder"     write somewhere else (default: this folder)

Or just ask Claude Code in a new terminal: "make me more EPTTS CSVs".

EVERY FILE HERE IS SINGLE-USE
-----------------------------
Uploading byte-identical content a second time is silently DEDUPLICATED: the platform returns the
earlier import job and imports nothing, while appearing to succeed. Once you have uploaded a file,
delete it and generate a fresh set. Every run mints new SGTINs, new SSCCs and a new lot.

WHERE TO UPLOAD
---------------
https://192.168.225.195:8444/import-jobs  (Citrix VPN required), signed in as the manufacturer
that owns GLN ${valid.gln}. The readPointGLN and bizLocationGLN in every row must equal your own
entity GLN, and the GTIN must be one your company owns — that is the single most common reason a
file is refused.

WHAT TO EXPECT
--------------
VALID-commission-pack-${valid.lot}.csv
    Import job should reach "completed": ${valid.packCount} packs commissioned and aggregated into
    SSCC ${valid.sscc}.

REJECT-<rule>-*.csv     the WHOLE file must be refused, not just the offending row
RETRY-<rule>-*.csv      the same identifiers with only the broken cell corrected; should complete

    badImportFlag    import column says 'yes'; only I, L, 1 or 0 are accepted
    seqNoGap         seqNo jumps, breaking the ascending-with-no-gaps rule
    mismatchedGlns   readPointGLN and bizLocationGLN differ from each other
    overlongLot      21-character lot, over the GS1 AI 10 limit of 20

Upload the REJECT file first, then its RETRY. Because the two differ by exactly one cell, a
rejection followed by a success proves the file was refused for THAT RULE and not for anything
about the identifiers.

COLUMN CONTRACT (order and case both matter)
--------------------------------------------
${CSV_COLUMNS.join(',')}
`
  fs.writeFileSync(path.join(OUT, 'README.txt'), readme, 'utf8')

  console.log(`\nwrote README.txt alongside the CSVs, with how to make more`)
  console.log(
    'Each file is SINGLE-USE: identical content is deduplicated and imports nothing (EPT-007).' +
      '\nRe-run this script for a fresh set.',
  )
}

main()
