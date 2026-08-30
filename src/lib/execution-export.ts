import { getFeature } from './features'
import { getExecutions, getExecutionBugs, getExecutionNotes, DEFAULT_EXECUTION_STATUS } from './execution'
import { getJiraIssueUrl } from './jira'
import { listBugsWithBodies } from './bugs'
import { EXECUTION_STATUSES, type ExecutionStatus } from './execution-types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExecutionExportRow {
  featureId: string
  testcaseId: string
  validity: string
  objective: string
  testData: string
  expectedResults: string
  status: ExecutionStatus
  linkedBug: string
  linkedBugUrl: string | null
  notes: string
}

export interface ExecutionExportData {
  featureName: string
  jiraKey?: string
  rows: ExecutionExportRow[]
  summary: Record<ExecutionStatus, number>
  total: number
}

// ─── Status display metadata ──────────────────────────────────────────────────

export const EXECUTION_STATUS_LABELS: Record<ExecutionStatus, string> = {
  new_added: 'New Added',
  ready: 'Ready for Test',
  pass: 'Pass',
  fail: 'Fail',
  blocked: 'Blocked/Skipped',
  under_testing: 'Under Testing',
}

export const EXECUTION_STATUS_FILLS: Record<ExecutionStatus, { fill: string; textWhite: boolean }> = {
  pass:          { fill: 'FF00B050', textWhite: false },
  fail:          { fill: 'FFFF0000', textWhite: true  },
  blocked:       { fill: 'FF808080', textWhite: true  },
  under_testing: { fill: 'FF7030A0', textWhite: true  },
  ready:         { fill: 'FF00B0F0', textWhite: false },
  new_added:     { fill: 'FFFFC000', textWhite: true  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Parses the full test case markdown table, returning all export-relevant columns. */
function parseTestcaseTableFull(
  markdown: string,
): Omit<ExecutionExportRow, 'status' | 'linkedBug' | 'linkedBugUrl' | 'notes'>[] {
  const rows: Omit<ExecutionExportRow, 'status' | 'linkedBug' | 'linkedBugUrl' | 'notes'>[] = []
  const lines = markdown.split('\n')
  let headerFound = false
  let separatorPassed = false
  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith('#')) continue
    if (!headerFound && line.includes('Feature ID') && line.includes('TestCase ID')) {
      headerFound = true
      continue
    }
    if (headerFound && !separatorPassed && line.includes('|---|')) {
      separatorPassed = true
      continue
    }
    if (separatorPassed && line.trim().startsWith('|')) {
      const cols = line.split('|')
      const testcaseId = cols[2]?.trim() ?? ''
      if (!testcaseId) continue
      rows.push({
        featureId:       cols[1]?.trim() ?? '',
        testcaseId,
        validity:        cols[4]?.trim() ?? '',
        objective:       cols[5]?.trim() ?? '',
        testData:        cols[8]?.trim() ?? '',
        expectedResults: cols[10]?.trim() ?? '',
      })
    }
  }
  return rows
}

interface BugLink {
  label: string
  url: string | null
}

/**
 * Resolves each testcase ID to its linked bug for the export. Prefers the
 * explicit execution-bugs.json link (raised from the execution tab); falls back
 * to the legacy heuristic of matching a bug whose body mentions the testcase ID
 * so bugs created before explicit linking still appear. Reported bugs show their
 * Jira key + a clickable issue URL; drafts show the slug tagged "(draft)".
 *
 * Uses bugs.ts's listBugsWithBodies() (DB-only) rather than listBugs()/getBug():
 * the heuristic fallback needs every bug body for this feature to scan for a
 * testcase-ID mention, and neither of the other two is shaped for that —
 * listBugs() filters by module (not feature) and its BugSummary omits body;
 * getBug() needs an already-known slug.
 */
async function buildBugLinks(
  appSlug: string,
  feature: string,
  testcaseIds: string[],
  version?: string,
): Promise<Record<string, BugLink>> {
  const bugs = await listBugsWithBodies(appSlug, feature)
  const bugBySlug = new Map(bugs.map((b) => [b.slug, b]))

  const explicit = await getExecutionBugs(appSlug, feature, version)

  const toLink = async (bug: { slug: string; jiraKey: string | null }): Promise<BugLink> => {
    if (bug.jiraKey) return { label: bug.jiraKey, url: await getJiraIssueUrl(bug.jiraKey) }
    return { label: `${bug.slug} (draft)`, url: null }
  }

  const map: Record<string, BugLink> = {}
  for (const id of testcaseIds) {
    const linkedSlug = explicit[id]
    const bug = linkedSlug ? bugBySlug.get(linkedSlug) : bugs.find((b) => b.body.includes(id))
    if (bug) map[id] = await toLink(bug)
  }
  return map
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function buildExecutionExport(
  appSlug: string,
  name: string,
  version?: string,
): Promise<ExecutionExportData | null> {
  const feature = await getFeature(appSlug, name)
  if (!feature) return null

  let content = feature.testcases
  let effectiveVersion = version
  if (version) {
    const match = feature.testcaseVersions.find((v) => v.filename === `${name}-testcases-v${version}.md`)
    if (match) content = match.content
  } else if (feature.testcaseVersions.length > 0) {
    const latest = feature.testcaseVersions[feature.testcaseVersions.length - 1]
    effectiveVersion = latest.filename.match(/-v(\d+)\.md$/)?.[1]
  }

  const parsed = parseTestcaseTableFull(content)
  const statuses = await getExecutions(appSlug, name, effectiveVersion)
  const bugMap = await buildBugLinks(appSlug, name, parsed.map((r) => r.testcaseId), effectiveVersion)
  const notesMap = await getExecutionNotes(appSlug, name, effectiveVersion)

  const summary = Object.fromEntries(
    EXECUTION_STATUSES.map((s) => [s, 0]),
  ) as Record<ExecutionStatus, number>

  const rows: ExecutionExportRow[] = parsed.map((r) => {
    const status = statuses[r.testcaseId] ?? DEFAULT_EXECUTION_STATUS
    summary[status]++
    const link = bugMap[r.testcaseId]
    return {
      ...r,
      status,
      linkedBug: link?.label ?? '',
      linkedBugUrl: link?.url ?? null,
      notes: notesMap[r.testcaseId] ?? '',
    }
  })

  return {
    featureName: feature.name,
    jiraKey: feature.jiraKey,
    rows,
    summary,
    total: rows.length,
  }
}

export function renderExecutionMarkdown(data: ExecutionExportData): string {
  const { featureName, jiraKey, rows, summary, total } = data
  const lines: string[] = []

  lines.push(`# ${featureName} — Test Execution Report`)
  lines.push('')
  if (jiraKey) lines.push(`**Jira:** ${jiraKey}`, '')
  lines.push('## Summary', '')
  lines.push('| Status | Count |')
  lines.push('|---|---|')
  for (const s of EXECUTION_STATUSES) {
    lines.push(`| ${EXECUTION_STATUS_LABELS[s]} | ${summary[s]} |`)
  }
  lines.push(`| **Total** | **${total}** |`, '')
  lines.push('## Test Cases', '')
  lines.push('| Feature ID | TestCase ID | Validity | Objective | Test Data | Expected Results | Execution Status | Linked Bug |')
  lines.push('|---|---|---|---|---|---|---|---|')

  const cell = (v: string) => v.replace(/\|/g, '\\|').replace(/\n+/g, ' ')
  for (const r of rows) {
    const bugCell = r.linkedBugUrl ? `[${cell(r.linkedBug)}](${r.linkedBugUrl})` : cell(r.linkedBug)
    lines.push(
      `| ${cell(r.featureId)} | ${cell(r.testcaseId)} | ${cell(r.validity)} | ${cell(r.objective)} | ${cell(r.testData)} | ${cell(r.expectedResults)} | ${EXECUTION_STATUS_LABELS[r.status]} | ${bugCell} |`,
    )
  }

  return lines.join('\n') + '\n'
}
