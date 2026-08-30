/**
 * Bulk-import CSV builder (NON-locked helper lib).
 *
 * Builds a fresh import CSV per run and writes it to the OS temp dir, returning
 * the absolute path so a spec can hand it straight to the file input.
 *
 * Column contract (live-verified 2026-07-23): the downloadable template ships
 * 24 generic columns but OMITS the type-specific identity columns, so for the
 * Application type callers must append `application_name` + `environment`
 * themselves — both are part of the required composite identity. This builder
 * always emits those two trailing columns.
 *
 * Row semantics for a valid Application row:
 * - identity = `application_name` + `environment` (both non-empty); keep them
 *   run-unique to dodge within-file / DB duplicate rejection on reruns.
 * - `primary_owner_id` is left BLANK — owner is optional, and supplied emails
 *   do NOT resolve on import (they resolve only in the manual-create dropdown),
 *   so any value here would be rejected as `primary_owner_id not found`.
 * - enum columns use the live tokens: `confidentiality_level` / `criticality`
 *   are UPPERCASE (INTERNAL, MEDIUM); `status` is lowercase (active).
 *
 * Vocabulary is deliberately neutral — no app-specific brand names.
 */
import fs from 'fs'
import os from 'os'
import path from 'path'
import { uniqueSuffix } from '../framework/data'

/** The 24 generic template columns, in the exact order the template emits them. */
const TEMPLATE_COLUMNS = [
  'asset_name',
  'primary_owner_id',
  'secondary_owner_id',
  'business_unit',
  'confidentiality_level',
  'criticality',
  'data_sensitivity',
  'status',
  'review_date',
  'expiry_date',
  'retention',
  'legal_hold',
  'is_archived',
  'linked_controls',
  'linked_risks',
  'linked_policies',
  'linked_vendors_systems',
  'frameworks',
  'contracts',
  'audits',
  'attachments',
  'attachments_url',
  'description',
  'notes',
] as const

/**
 * Full column order written to disk: the 24 generic template columns PLUS the
 * type-specific Application identity columns the template omits.
 */
export const COLUMNS = [...TEMPLATE_COLUMNS, 'application_name', 'environment'] as const

export type ColName = (typeof COLUMNS)[number]

/** A single import row — every column optional; unspecified columns are written blank. */
export type ImportRow = Partial<Record<ColName, string>>

/** Quote a single CSV field only when it contains a comma, quote, or newline; escape `"` as `""`. */
function csvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/** Serialise one row into the fixed COLUMNS order, blanks for any missing column. */
function csvRow(row: ImportRow): string {
  return COLUMNS.map((col) => csvField(row[col] ?? '')).join(',')
}

/**
 * A valid Application import row keyed on `uniq` for a stable, run-unique
 * identity. Sets only the columns needed to pass validation and leaves every
 * other column blank; `overrides` are applied last so callers can turn a valid
 * row into a targeted invalid one.
 */
export function validApplicationRow(uniq: string, overrides?: Partial<ImportRow>): ImportRow {
  const base: ImportRow = {
    asset_name: `App ${uniq}`,
    primary_owner_id: '', // owner optional; supplied emails are rejected on import
    secondary_owner_id: '',
    business_unit: '',
    confidentiality_level: 'INTERNAL',
    criticality: 'MEDIUM',
    data_sensitivity: '',
    status: 'active',
    review_date: '',
    expiry_date: '',
    retention: '',
    legal_hold: '',
    is_archived: '',
    linked_controls: '',
    linked_risks: '',
    linked_policies: '',
    linked_vendors_systems: '',
    frameworks: '',
    contracts: '',
    audits: '',
    attachments: '',
    attachments_url: '',
    description: '',
    notes: '',
    application_name: `app-${uniq}`,
    environment: 'production',
  }
  return { ...base, ...overrides }
}

/**
 * Write `rows` (with a header line) to `${os.tmpdir()}/${namePrefix}-${uniqueSuffix()}.csv`
 * and return the absolute path. The filename suffix keeps concurrent runs from
 * clobbering each other's fixture.
 */
export function writeImportCsv(rows: ImportRow[], namePrefix = 'bim'): string {
  const lines = [COLUMNS.join(','), ...rows.map(csvRow)]
  const filePath = path.join(os.tmpdir(), `${namePrefix}-${uniqueSuffix()}.csv`)
  fs.writeFileSync(filePath, lines.join('\r\n'), 'utf8')
  return filePath
}

/**
 * Return a row that shares `row`'s COMPOSITE identity (`application_name` +
 * `environment`) so the two collide under the importer's dedup key. `asset_name`
 * is intentionally changed (a `(dup)` suffix) to prove dedup keys on identity,
 * NOT asset_name (BIM_021 within-file duplicate, BIM_022 identity-vs-name).
 */
export function duplicateRowOf(row: ImportRow): ImportRow {
  return {
    ...row,
    asset_name: row.asset_name ? `${row.asset_name} (dup)` : row.asset_name,
    application_name: row.application_name,
    environment: row.environment,
  }
}

/**
 * Write a header-only CSV (the COLUMNS header line, no data rows) and return the
 * absolute path — for the empty/header-only upload case (BIM_041).
 */
export function writeHeaderOnlyCsv(namePrefix = 'bim'): string {
  const filePath = path.join(os.tmpdir(), `${namePrefix}-${uniqueSuffix()}.csv`)
  fs.writeFileSync(filePath, COLUMNS.join(','), 'utf8')
  return filePath
}

/**
 * Write a valid-schema CSV padded past the importer's 10 MB cap for the
 * size-limit case (BIM_009). Rows are valid Application rows with a long `notes`
 * filler; unique per-row identities avoid within-file/DB duplicate rejection.
 * `targetMB` (default 12) sets the approximate on-disk size — keep it above 10.
 */
export function writeOversizeCsv(namePrefix = 'bim', targetMB = 12): string {
  const targetBytes = targetMB * 1024 * 1024
  const pad = 'x'.repeat(50_000) // long free-text notes filler
  const rows: ImportRow[] = []
  let size = COLUMNS.join(',').length
  let i = 0
  while (size < targetBytes) {
    const row = validApplicationRow(`${uniqueSuffix()}-${i}`, { notes: pad })
    rows.push(row)
    size += csvRow(row).length + 2 // +2 for the CRLF line separator
    i++
  }
  return writeImportCsv(rows, namePrefix)
}
