/**
 * Emit one Automation Hub project per automatable dashboard case.
 *
 * Split from eptts-web-hub-cases.js so that file stays about WHICH cases to automate and this
 * one about what the spec looks like.
 */
const fs = require('fs')
const path = require('path')

/** How each classified behaviour turns into assertions on DashboardPage. */
const BODY = {
  render: (t) => [
    ...(t.heading ? [`    .expectHeading('${esc(t.heading)}')`] : []),
    ...(controls(t).length ? [`    .expectControls([${controls(t).map((c) => `'${esc(c)}'`).join(', ')}])`] : []),
    `    .expectNoRawTranslationKeys()`,
    `    .expectNoErrorBanner()`,
  ],
  directUrl: (t) => [
    `    .expectSurvivesReload('${t.route}')`,
    `    .expectNoErrorBanner()`,
  ],
  columns: (t) => [
    `    .expectTableColumns([${t.columns.slice(0, 6).map((c) => `'${esc(c)}'`).join(', ')}])`,
  ],
  emptyState: (t) => [
    `    .expectEmptyState('${esc(t.search)}', 'zzz-no-such-record-zzz')`,
  ],
  searchFilters: (t) => [
    `    .expectSearchFilters('${esc(t.search)}', 'a')`,
  ],
  backendFailure: (t) => [
    `    .expectBackendFailureHandled('${esc(t.xhr)}')`,
  ],
  csv: (t) => [
    `    .expectCsvDownload('${esc(t.exportButton)}')`,
  ],
  apiKeyMasked: () => [
    `    .expectNoFullApiKey()`,
  ],
}

const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")

const RAW_KEY = /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)+$/
function controls(t) {
  return (t.buttons ?? [])
    .filter((b) => b && b !== 'AR' && b !== 'EN' && b.length >= 3 && b.length < 32 &&
      /[A-Za-z]{3}/.test(b) && !RAW_KEY.test(b))
    .slice(0, 3)
}

const WHY = {
  render: 'the page renders its heading and primary controls',
  directUrl: 'the route is reachable directly and survives a refresh — this is a fragment-mode OIDC SPA, so a reload re-runs the whole auth round trip',
  columns: 'the table exposes every column the page promises',
  emptyState: 'a filter matching nothing shows an empty state rather than stale rows or an endless spinner',
  searchFilters: 'search narrows the result set rather than ignoring the input',
  backendFailure: 'a failing API is reported to the user; an empty table after a 500 is indistinguishable from genuinely having no data',
  csv: 'the export produces a CSV file',
  session: 'an expired session sends the user back to sign in rather than showing a broken page',
  roleBlocked: 'a role without permission is refused, not merely un-linked in the menu',
  apiKeyMasked: 'no API key is rendered in full — the platform cannot re-display an issued key, so one shown on screen is a long-lived credential leaked into the UI',
}

/** Open the page or its tab. */
const opener = (t) => t.tab
  ? `DashboardPage.openTab(page, '${t.route}', '${esc(t.tab)}')`
  : `DashboardPage.open(page, '${t.route}')`

function chainSpec(t, c, kind) {
  return `/**
 * ${c.id} — ${c.title}
 *
 * Feature: ${t.feature}   Route: ${t.route}${t.tab ? ` → tab "${t.tab}"` : ''}
 *
 * Checks that ${WHY[kind]}.
 *
 * Read-only: navigates and asserts, submits nothing. Elements asserted are what discovery
 * observed on the page, not a specification.
 */
import { test } from '@playwright/test'
import { DashboardPage } from '../../pages/eptts-web/dashboard.page'
import { stateFor } from '../../lib/apps'

// The cached login state carries localStorage.lang=en, so the UI opens in English.
test.use({ storageState: stateFor('eptts-web'), ignoreHTTPSErrors: true })

test('${c.id} — ${esc(c.title)}', async ({ page }) => {
  test.slow()
  await ${opener(t)}
    .expectEnglish()
${BODY[kind](t).join('\n')}
})
`
}

/**
 * Session expiry needs its own shape: the storage state is cleared mid-test, so it cannot be
 * expressed as a chain on an already-open page.
 */
function sessionSpec(t, c) {
  return `/**
 * ${c.id} — ${c.title}
 *
 * Feature: ${t.feature}   Route: ${t.route}
 *
 * Checks that ${WHY.session}.
 *
 * The session is ended by clearing the browser's cookies, which is what an expired Keycloak
 * session looks like to the app. Read-only: nothing is submitted, and the cached state file on
 * disk is untouched — only this context's copy is cleared.
 */
import { test, expect } from '@playwright/test'
import { DashboardPage } from '../../pages/eptts-web/dashboard.page'
import { stateFor } from '../../lib/apps'

test.use({ storageState: stateFor('eptts-web'), ignoreHTTPSErrors: true })

test('${c.id} — ${esc(c.title)}', async ({ page, context }) => {
  test.slow()
  await ${opener(t)}.expectEnglish()

  await context.clearCookies()
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {})
  await page.waitForTimeout(2000)

  // Either the Keycloak form or an explicit signed-out state. What must NOT happen is the
  // app carrying on as though the session were still valid, or hanging on a blank page.
  const signedOut = await page.evaluate(() =>
    !!document.querySelector('#kc-login, #username') ||
    /sign in|log in|session (has )?expired/i.test(document.body.innerText))
  expect(
    signedOut,
    'an expired session returns the user to sign-in instead of leaving a broken page',
  ).toBe(true)
})
`
}

/** Role isolation runs as the manufacturer, so it needs that role's cached state. */
function roleSpec(t, c) {
  return `/**
 * ${c.id} — ${c.title}
 *
 * Feature: ${t.feature}   Route: ${t.route}
 *
 * Checks that ${WHY.roleBlocked}.
 *
 * Runs as the MANUFACTURER, not the admin — role isolation cannot be tested from a privileged
 * session. That this route blocks was measured (scripts/eptts-web-role-matrix.js), not assumed:
 * a manufacturer legitimately uses Shipping and Trace, so this check is only generated for
 * routes the platform actually refuses.
 *
 * Read-only: navigates and asserts, submits nothing.
 */
import { test, expect } from '@playwright/test'
import { ensureRoleState } from '../../pages/eptts-web/roles'
import { baseUrl } from '../../lib/apps'

test.use({ ignoreHTTPSErrors: true })

test('${c.id} — ${esc(c.title)}', async ({ browser }) => {
  test.slow()
  const storageState = await ensureRoleState('manufacturer')
  const ctx = await browser.newContext({ storageState, ignoreHTTPSErrors: true })
  const page = await ctx.newPage()
  try {
    await page.goto(baseUrl('eptts-web') + '${t.route}', { waitUntil: 'domcontentloaded', timeout: 45_000 })
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
    await page.waitForTimeout(1500)

    const { path: landed, text } = await page.evaluate(() => ({
      path: location.pathname,
      text: document.body.innerText.slice(0, 400),
    }))
    const refused = landed !== '${t.route}' ||
      /unauthori[sz]ed|forbidden|access denied|not permitted|no permission/i.test(text)

    expect(
      refused,
      \`a manufacturer must not reach ${t.route} — landed on \${landed}\`,
    ).toBe(true)
  } finally {
    await ctx.close()
  }
})
`
}

module.exports = function emit({ targets, classify, casesOf, PROJECTS, WRITE }) {
  const emitted = []
  const skipped = new Map()

  for (const t of targets) {
    for (const c of casesOf(t.feature)) {
      const verdict = classify(c.title, t)
      if (verdict.skip) {
        const list = skipped.get(verdict.skip) ?? []
        list.push(c.id)
        skipped.set(verdict.skip, list)
        continue
      }
      const kind = verdict.kind
      const name = `eptts-web-${t.name}-${c.id.toLowerCase()}`
      const spec = kind === 'session' ? sessionSpec(t, c)
        : kind === 'roleBlocked' ? roleSpec(t, c)
          : chainSpec(t, c, kind)

      emitted.push({ name, kind, id: c.id, feature: t.feature })
      if (!WRITE) continue

      const dir = path.join(PROJECTS, name)
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(path.join(dir, 'test.spec.ts'), spec, 'utf8')

      const meta = {
        name,
        title: `${c.id} — ${c.title}`,
        app: 'eptts-web',
        createdVia: 'testcase',
        linkedTestcaseId: c.id,
        linkedTestcase: { app: 'eptts-web', feature: t.feature, testcaseId: c.id },
        createdAt: '2026-09-01T04:00:00.000Z',
        lastStatus: 'never_run',
        runs: [],
        tags: ['dashboard', 'readonly', kind, ...(t.tab ? ['tab'] : [])],
        folder: `EPTTS Web / ${t.feature}`,
        engine: 'playwright',
      }
      const metaPath = path.join(dir, 'meta.json')
      if (fs.existsSync(metaPath)) {
        const existing = JSON.parse(fs.readFileSync(metaPath, 'utf8'))
        meta.runs = existing.runs ?? []
        meta.lastStatus = existing.lastStatus ?? 'never_run'
        meta.createdAt = existing.createdAt ?? meta.createdAt
      }
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n', 'utf8')
    }
  }

  console.log(WRITE ? '=== WROTE ===' : '=== DRY RUN (pass --write) ===')
  const byKind = {}
  for (const e of emitted) byKind[e.kind] = (byKind[e.kind] ?? 0) + 1
  for (const [k, n] of Object.entries(byKind).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(3)}  ${k}`)
  }
  console.log(`\nautomated: ${emitted.length} case(s) across ${new Set(emitted.map((e) => e.feature)).size} feature(s)`)

  const skippedTotal = [...skipped.values()].reduce((n, l) => n + l.length, 0)
  console.log(`\nnot automated: ${skippedTotal} case(s)`)
  for (const [reason, ids] of [...skipped].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${String(ids.length).padStart(3)}  ${reason}`)
  }
  if (!WRITE) console.log('\n(dry run — nothing written)')
}
