/**
 * Commissioning + packing CSV builder for the dashboard's /import-jobs upload.
 *
 * Builds a fresh import file per run, writes it to the OS temp dir, and returns the absolute
 * path plus every identifier it minted — so a spec can hand the path to a file input and then
 * assert against the exact EPCs it uploaded. Same shape as lib/grc/bulk-import-csv.ts.
 *
 * THE COLUMN CONTRACT IS NOT GUESSWORK. It was established by a 139-fixture manual campaign
 * (the "CSV bulk upload" project) that filed 16 bugs against this importer, and the rules
 * encoded below are the ones that campaign proved. In particular:
 *
 * - The header must match EXACTLY — case, spelling and order. Lowercase `bizstep`, capitalised
 *   `SeqNo`, a reordered column, a missing `manufDate`, or one extra trailing column are each
 *   rejected outright (fixtures CSV_014..CSV_020).
 * - `readPointGLN` and `bizLocationGLN` must be equal AND be the acting manufacturer's own GLN.
 *   All three rules are enforced separately, and the "columns must match" rule fires first and
 *   masks the other two.
 * - The GTIN must belong to the acting manufacturer:
 *     "GTIN 05413868120202 is owned by manufacturer 7612682000013, but this file's source is
 *      7640128010005"
 * - `import` must be one of I, L, 1, 0 — `Row 50: import: Must be 'I', 'L', '1', or '0', got 'yes'`.
 * - LOT is <=20 chars per GS1 AI 10; 21 chars is rejected naming the limit.
 * - `seqNo` must start at 1 and ascend with no gaps, duplicates or descents.
 * - ONE BAD ROW REJECTS THE WHOLE FILE. Proven twice, at row 50 of 100 and row 99 of 100:
 *   `packsCreated 0`, and re-uploading the corrected file created all 100 fresh with
 *   `packsSkipped 0` — so nothing from the failed attempt had been committed. Position is
 *   irrelevant. This is why the negative case can assert "and nothing was created".
 *
 * FRESHNESS IS CORRECTNESS, NOT HYGIENE. Re-uploading byte-identical content is silently
 * deduplicated and returns the EARLIER job (bug EPT-007, still open). A fixed fixture would
 * therefore make a test pass while importing nothing at all. Every identifier here is derived
 * from runId(), so no two runs can collide and every row is traceable to the run that made it.
 *
 * ON THE 18-DIGIT SSCC: the shipped template's SSCC (062812345000000014) is 18 digits with a
 * correct check digit, and that is the format followed here — a well-formed SSCC cannot be
 * refused for being malformed, which keeps a failure attributable to the thing under test.
 *
 * The campaign's own `CSV_013__valid-baseline...csv` currently holds a NINETEEN-digit SSCC whose
 * check digit validates under no reading of the GS1 rule, so it is not a usable reference. Worth
 * being precise about why it fails today, though, because the obvious inference is wrong: an
 * upload of it on 2026-09-08 was refused with
 *
 *   Row 1: readPointGLN/bizLocationGLN must match your own entity GLN (5413868000009) —
 *   you can only import EPCIS data for your own location.
 *
 * i.e. it is written for tenant 7640128010005 and never got as far as SSCC validation. The
 * malformed SSCC is real but unproven as a cause.
 *
 * THE ACTING USER OWNS THE SOURCE GLN, NOT THE FILE. The upload dialog shows "Source
 * (Manufacturer)" as read-only text taken from the session, there is no GLN input, and the
 * importer then requires every row's readPointGLN and bizLocationGLN to equal that entity's own
 * GLN. So a file is only importable by the party it was written for, and EPTTS_WEB_MFG_GLN here
 * must be the GLN of whoever the spec is logged in as.
 */
import fs from 'fs'
import os from 'os'
import path from 'path'
import { gs1CheckDigit, runId, ssccFor, ssccUrnToDigits, uniqueSerial } from './eptts-api'
import { requireEnv } from './env'

/**
 * The 11 columns, in the exact order and casing the importer demands.
 *
 * Note the inconsistent casing (`seqNo`, `Bizstep`, `Parent`, `readPointGLN`) — it is not a
 * transcription error, it is the contract, and normalising it is a rejection.
 */
export const CSV_COLUMNS = [
  'seqNo',
  'Bizstep',
  'eventTime',
  'timeOffset',
  'readPointGLN',
  'bizLocationGLN',
  'epc',
  'Parent',
  'import',
  'expiryDate',
  'manufDate',
] as const

/** A fault to inject, for the negative cases. Each maps to a rule the importer enforces. */
export type CsvFault =
  | 'badImportFlag' // import: 'yes' — must be I, L, 1 or 0
  | 'seqNoGap' // seqNo jumps, breaking the ascending-no-gaps rule
  | 'mismatchedGlns' // readPointGLN !== bizLocationGLN
  | 'overlongLot' // LOT of 21 chars, over the GS1 AI 10 limit

export interface CommissionPackCsv {
  /** Absolute path to hand to setInputFiles / browser_file_upload. */
  path: string
  filename: string
  /** The raw text, so a failure can report what was actually uploaded. */
  csv: string
  gln: string
  gtin: string
  lot: string
  /** Bracket-AI SGTINs, `(01)<gtin>(21)<serial>`, in commissioning order. */
  sgtins: string[]
  /** The 18-digit SSCC element string, as it appears in the file after `(00)`. */
  sscc: string
  /** How many packs this file commissions and then packs into the one SSCC. */
  packCount: number
  /** 1-based row number carrying the injected fault, or null for a clean file. */
  faultRow: number | null
  /** Fault injected, or null. */
  fault: CsvFault | null
}

export interface BuildCsvOptions {
  /** Packs to commission and pack. Default 4, matching the campaign's verified baseline. */
  packCount?: number
  /** Inject a fault so the importer must reject the whole file. */
  fault?: CsvFault
  /** Override the acting manufacturer's GLN. Defaults to EPTTS_WEB_MFG_GLN. */
  gln?: string
  /** Override the product. Defaults to EPTTS_WEB_MFG_CSV_GTIN. */
  gtin?: string
}

/** `YYYY-MM-DDT` — the trailing `T` with no time is what the template and the fixtures both emit. */
function dateOnly(d: Date): string {
  return `${d.toISOString().slice(0, 10)}T`
}

/**
 * A fresh, well-formed 18-digit SSCC under the manufacturer's company prefix.
 *
 * Built by composing the two existing helpers rather than reimplementing the layout: ssccFor()
 * produces the URN and pads the serial reference to the width the prefix leaves, and
 * ssccUrnToDigits() moves the extension digit to the front and appends the mod-10 check digit.
 * Doing it by hand is how you get an off-by-one in the extension digit.
 *
 * THE SERIAL REFERENCE IS BUILT HERE RATHER THAN LEFT TO ssccFor's DEFAULT, and that is not
 * fussiness. That default is
 *
 *     (String(Date.now() % 10 ** width) + String(++serialCounter)).slice(0, width)
 *
 * and for this tenant `width` is 10 (17 digits, less a 7-digit company prefix). `Date.now() %
 * 10 ** 10` is already 10 digits, so the slice discards the counter completely and the value is
 * time-only: 25 successive builds in one process yielded just 15 distinct SSCCs. A repeat is
 * worse than an error here, because a duplicate SSCC is silently deduplicated (EPT-007) and the
 * upload reports the EARLIER job — so the test passes having imported nothing.
 *
 * An SSCC is all-digits, so the run-scoped `ZTG…` serial used for the SGTINs cannot carry over.
 * Instead the width is split explicitly: the low digits of the clock for cross-process
 * uniqueness, and a reserved 4-digit counter tail for within-process uniqueness, so neither can
 * be truncated away by the other.
 *
 * (The same latent flaw affects freshSscc() in lib/eptts-api.ts, which does use the default.
 * Left alone deliberately — it is depended on across the API suite and is not this change's to
 * alter — but it is reported.)
 */
let ssccCounter = 0

function ssccSerialRef(width: number): string {
  const tail = 4
  if (width <= tail) {
    // A prefix long enough to leave <=4 digits cannot fit both halves; fall back to pure clock.
    return String(Date.now()).slice(-width)
  }
  const counter = String(++ssccCounter % 10 ** tail).padStart(tail, '0')
  const clock = String(Date.now()).slice(-(width - tail))
  return clock + counter
}

function freshSsccDigits(companyPrefix: string): string {
  const width = 17 - companyPrefix.replace(/\D/g, '').length
  return ssccUrnToDigits(ssccFor(companyPrefix, ssccSerialRef(width)))
}

/** Assert a GTIN-14's own check digit, so a typo'd override fails here and not on the platform. */
function assertGtin(gtin: string): string {
  const g = gtin.replace(/\D/g, '')
  if (g.length !== 14) {
    throw new Error(
      `GTIN must be 14 digits, got "${gtin}" (${g.length}) — check EPTTS_WEB_MFG_CSV_GTIN`,
    )
  }
  const expected = gs1CheckDigit(g.slice(0, 13))
  if (expected !== g[13]) {
    throw new Error(
      `GTIN "${g}" fails its own GS1 check digit (expected ${expected}, got ${g[13]}). ` +
        `Uploading it would be refused for a reason unrelated to the case under test.`,
    )
  }
  return g
}

/** The identifiers one logical import is built from. Rendered once per variant. */
interface CsvIdentity {
  gln: string
  gtin: string
  lot: string
  sgtins: string[]
  sscc: string
  eventTime: string
  expiry: string
  manuf: string
}

/** Mint a fresh identity: new serials, new SSCC, new lot. */
function mintIdentity(opts: BuildCsvOptions): CsvIdentity {
  const packCount = opts.packCount ?? 4
  const gln = (opts.gln ?? requireEnv('EPTTS_WEB_MFG_GLN')).replace(/\D/g, '')
  const gtin = assertGtin(opts.gtin ?? requireEnv('EPTTS_WEB_MFG_CSV_GTIN'))
  const prefix = requireEnv('EPTTS_WEB_MFG_PREFIX').replace(/\D/g, '')
  const now = new Date()
  return {
    gln,
    gtin,
    // LOT stays well inside the 20-char AI 10 limit, and carries the run id so a row found on
    // production months later is traceable to the run that wrote it.
    lot: `ZTG${runId()}`.slice(0, 20),
    sgtins: Array.from({ length: packCount }, () => `(01)${gtin}(21)${uniqueSerial()}`),
    sscc: freshSsccDigits(prefix),
    eventTime: `${now.toISOString().slice(0, 19)}Z`,
    expiry: dateOnly(new Date(now.getTime() + 730 * 86_400_000)), // ~2 years out
    manuf: dateOnly(new Date(now.getTime() - 30 * 86_400_000)),
  }
}

/** Render one identity to a file, optionally with a fault injected. */
function render(id: CsvIdentity, fault: CsvFault | null): CommissionPackCsv {
  const packCount = id.sgtins.length

  // Faults are applied to a specific row so the case can assert the importer NAMES that row.
  // The SSCC row sits mid-file, which is the interesting position given the all-or-nothing rule.
  const faultRow = fault ? (fault === 'seqNoGap' ? packCount + 1 : 1) : null

  const rows: string[][] = []
  const push = (bizstep: string, epc: string, parent: string, exp: string, man: string) => {
    const n = rows.length + 1
    const faulty = faultRow === n
    rows.push([
      String(faulty && fault === 'seqNoGap' ? n + 1 : n),
      bizstep,
      id.eventTime,
      '+02:00',
      id.gln,
      faulty && fault === 'mismatchedGlns' ? `${id.gln.slice(0, -1)}0` : id.gln,
      epc,
      faulty && fault === 'overlongLot' ? `(10)${'Z'.repeat(21)}` : parent,
      faulty && fault === 'badImportFlag' ? 'yes' : 'L',
      exp,
      man,
    ])
  }

  for (const sgtin of id.sgtins) push('commissioning', sgtin, `(10)${id.lot}`, id.expiry, id.manuf)
  push('commissioning', `(00)${id.sscc}`, '', '', '')
  for (const sgtin of id.sgtins) push('packing', sgtin, `(00)${id.sscc}`, '', '')

  // CRLF: Excel is the tool these files are authored in. The campaign verified LF-only and
  // CR-only import too (CSV_025/026), so this is the safe choice rather than the only one.
  const csv = [CSV_COLUMNS.join(','), ...rows.map((r) => r.join(','))].join('\r\n') + '\r\n'

  const filename = `eptts-commission-pack-${runId()}-${id.sscc.slice(-6)}${fault ? `-${fault}` : ''}.csv`
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eptts-csv-'))
  const file = path.join(dir, filename)
  fs.writeFileSync(file, csv, 'utf8')

  return {
    path: file,
    filename,
    csv,
    gln: id.gln,
    gtin: id.gtin,
    lot: id.lot,
    sgtins: id.sgtins,
    sscc: id.sscc,
    packCount,
    faultRow,
    fault,
  }
}

/**
 * Build a commissioning + packing CSV: `packCount` SGTINs commissioned under one LOT, one SSCC
 * commissioned, then every SGTIN packed into that SSCC.
 *
 * The verified shape (4 packs) imports as `status: completed, packsCreated 4, packsSkipped 0,
 * aggregationsCreated 1, errorCount 0, warningCount 1` — measured against devsim 2026-09-08.
 */
export function buildCommissionPackCsv(opts: BuildCsvOptions = {}): CommissionPackCsv {
  const packCount = opts.packCount ?? 4
  if (packCount < 1) throw new Error(`packCount must be at least 1, got ${packCount}`)
  return render(mintIdentity(opts), opts.fault ?? null)
}

/**
 * Build a faulted file and its correction, SHARING EVERY IDENTIFIER.
 *
 * This exists because the all-or-nothing case cannot be proven with two independent files. Its
 * argument is: upload the faulted file, see it refused, upload the corrected one, and if
 * `packsSkipped` is zero then the first attempt committed nothing — because `packsSkipped` is how
 * the importer reports rows that already exist.
 *
 * That only holds if the two files carry the SAME SGTINs and SSCC. Calling
 * buildCommissionPackCsv twice mints fresh identifiers each time, so `packsSkipped: 0` would be
 * true no matter what the first upload had written, and the case would prove nothing while
 * looking like it did. One identity, rendered twice, is the fix.
 */
export function buildCommissionPackCsvPair(
  fault: CsvFault,
  opts: Omit<BuildCsvOptions, 'fault'> = {},
): { faulted: CommissionPackCsv; corrected: CommissionPackCsv } {
  const packCount = opts.packCount ?? 4
  if (packCount < 1) throw new Error(`packCount must be at least 1, got ${packCount}`)
  const identity = mintIdentity(opts)
  return { faulted: render(identity, fault), corrected: render(identity, null) }
}
