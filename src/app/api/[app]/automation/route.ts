import { NextRequest, NextResponse } from 'next/server'
import { guardApp } from '@/lib/auth'
import { listProjects, createProject, slugify, listTsPageFiles, saveTsPageFile } from '@automation-hub/store'
import { listTsPageFileContents } from '@automation-hub/lib/pom-index'
import { type AppiumTarget, type AutomationEngine, validateAppiumTarget, isBrowserEngine }
  from '@automation-hub/types'
import { getApp } from '@/lib/apps'

// The Automation Hub runs Playwright as a child process — force the Node runtime.
export const runtime = 'nodejs'

/** GET /api/[app]/automation — list this app's automation projects (meta only). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ app: string }> },
) {
  const { app } = await params
  const guard = await guardApp(app, 'automation.view')
  if (!guard.ok) return guard.response
  // Legacy projects (created before app scoping) have no `app` — show them everywhere.
  const projects = (await listProjects()).filter((p) => !p.app || p.app === app)
  return NextResponse.json(projects)
}

const STARTER_SPEC_APPIUM = `import { runSpec } from '../../engine/appium/harness.mjs'

await runSpec(async (driver) => {
  const el = await driver.$('~someAccessibilityId')
  await el.waitForDisplayed()
  await el.click()
})
`

/**
 * Starter for an API project: a plain @playwright/test spec driving APIRequestContext.
 *
 * Deliberately NO `stateFor()` and no `test.use({ storageState })`. An API project runs
 * under the config's browserless `api` project, so there is no browser context to hydrate
 * and no login bootstrap to depend on — and referencing a storage-state file that was
 * never written fails the spec at collection with an opaque error.
 *
 * Base URL and credentials come from process.env (values live in automation-hub/.env),
 * never inline: exports and specs are committed.
 */
const starterApi = (title: string) => `import { test, expect } from '@playwright/test'

test('${title}', async ({ request }) => {
  // \`request\` is an APIRequestContext — no browser is launched. The config's \`api\`
  // project sets ignoreHTTPSErrors, which the EPTTS host needs (self-signed cert).
  const res = await request.get(\`\${process.env.API_BASE_URL}/health\`, {
    headers: { Accept: 'application/json' },
  })
  expect(res.status(), 'the endpoint answers').toBe(200)

  // Most of this platform is asynchronous: a 2xx means "accepted", not "done". If this
  // endpoint queues work, poll its status endpoint and assert THAT, not the status code.
})
`

/** "item-create" -> "ItemCreate" (PascalCase from a hyphenated slug). */
function pascalCase(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join('')
}

/** First `export class X` name found in a page file's source, or null. */
function parseClassName(content: string): string | null {
  return /export class (\w+)/.exec(content)?.[1] ?? null
}

/** Import path (from projects/<name>/test.spec.ts) for a `pages/<app>/<slug>.page.ts` rel path. */
function importPathFor(relPath: string): string {
  return `../../${relPath.replace(/\.ts$/, '')}`
}

/**
 * Deterministic (no-AI) fluent test starter, used by manual create. `page` — when
 * given — names the one page class the example chain (commented; the tester fills
 * in the real flow) starts from, matching the one-page-per-test rule.
 */
function fluentStarter(app: string, title: string, page?: { importPath: string; className: string }): string {
  const pageImportLine = page ? `import { ${page.className} } from '${page.importPath}'\n` : ''
  const exampleClass = page?.className ?? 'SomePage'
  return `import { test } from '@playwright/test'
import { stateFor } from '../../lib/apps'
import { uniqueSuffix } from '../../lib/framework/data'
${pageImportLine}
test.use({ storageState: stateFor('${app}') })

test('${title}', async ({ page }) => {
  // TODO: replace this example with your flow — every chain starts from a single
  // page class's static \`open()\` and ends with one \`await\`.
  // const uniq = uniqueSuffix()
  // await ${exampleClass}.open(page)
  //   .someAction('value')
  //   .assertSomething()
})
`
}

/** Deterministic (no-AI) scaffold for a brand-new page-object file. */
function scaffoldPageTemplate(className: string, app: string): string {
  return `import { FluentPage } from '../../lib/framework/fluent-page'

/**
 * ${className} — scaffolded page object.
 * TODO: fill in this screen's locators, actions, and validations.
 */
export class ${className} extends FluentPage {
  // TODO: add page actions/validations here — each public method should
  // \`return this.step(async () => { ... })\` (see lib/framework/fluent-page.ts).

  // static open(page: Page): ${className} {
  //   return new ${className}(page).step(() => ensureLoggedIn(page, '${app}', '/${app}/...'))
  // }
}
`
}

/**
 * POST /api/[app]/automation — create a new project
 * { title, spec?, engine?, appium?, startPagePath?, newPageScreen? }.
 *
 * `startPagePath` / `newPageScreen` are Playwright-only (ignored for the appium
 * engine) and mutually exclusive: `startPagePath` binds the starter test to an
 * existing `pages/<app>/*.page.ts` class; `newPageScreen` scaffolds a brand-new
 * one (deterministic, no AI) and binds to that instead.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ app: string }> },
) {
  const { app } = await params
  const guard = await guardApp(app, 'automation.edit')
  if (!guard.ok) return guard.response

  const body = await req.json().catch(() => ({}))
  const title = String(body?.title ?? '').trim()
  if (!title) return NextResponse.json({ error: 'A title is required' }, { status: 400 })

  // Engine comes from the APP first, not from the client. Every downstream decision keys
  // off meta.engine — which config project the runner selects, whether page objects are
  // scaffolded, whether the AI codegen prompt is allowed near the spec — so an API app must
  // never end up holding a browser project because a stale client sent the wrong value.
  //
  // Note 'playwright' stays `undefined`: hundreds of legacy projects predate the field and
  // absent means browser-Playwright. 'api' and 'appium' are always explicit.
  const appType = (await getApp(app))?.type
  const requested = body?.engine
  if (appType === 'api' && requested && requested !== 'api') {
    return NextResponse.json(
      { error: `This is an API app — only the api engine is available (got "${requested}")` },
      { status: 400 },
    )
  }
  const engine: AutomationEngine | undefined =
    appType === 'api' ? 'api'
      : requested === 'appium' ? 'appium'
        : requested === 'api' ? 'api'
          : undefined

  let appium: AppiumTarget | undefined
  if (engine === 'appium') {
    appium = {}
    const apkPath = String(body?.appium?.apkPath ?? '').trim()
    if (apkPath) appium.apkPath = apkPath
    const appPackage = String(body?.appium?.appPackage ?? '').trim()
    if (appPackage) appium.appPackage = appPackage
    const appActivity = String(body?.appium?.appActivity ?? '').trim()
    if (appActivity) appium.appActivity = appActivity
    const avd = String(body?.appium?.avd ?? '').trim()
    if (avd) appium.avd = avd
    const udid = String(body?.appium?.udid ?? '').trim()
    if (udid) appium.udid = udid
    appium.noReset = body?.appium?.noReset === true

    const error = validateAppiumTarget(appium)
    if (error) return NextResponse.json({ error }, { status: 400 })
  }

  // Starting-page selection — the BROWSER Playwright engine only. `!== 'appium'` would
  // silently admit 'api' and scaffold a page object for an app that has no pages.
  let page: { importPath: string; className: string } | undefined
  if (isBrowserEngine(engine)) {
    const startPagePath = typeof body?.startPagePath === 'string' ? body.startPagePath.trim() : ''
    const newPageScreen = typeof body?.newPageScreen === 'string' ? body.newPageScreen.trim() : ''
    if (startPagePath && newPageScreen) {
      return NextResponse.json({ error: 'Provide only one of startPagePath or newPageScreen' }, { status: 400 })
    }
    if (startPagePath) {
      const known = await listTsPageFiles(app)
      if (!known.includes(startPagePath)) {
        return NextResponse.json({ error: `Unknown page "${startPagePath}"` }, { status: 400 })
      }
      const content = listTsPageFileContents(app).find((f: { path: string; content: string }) => f.path === startPagePath)?.content ?? ''
      const className = parseClassName(content)
      if (!className) {
        return NextResponse.json({ error: `Could not read a page class from "${startPagePath}"` }, { status: 400 })
      }
      page = { importPath: importPathFor(startPagePath), className }
    } else if (newPageScreen) {
      const slug = slugify(newPageScreen)
      const relPath = `pages/${app}/${slug}.page.ts`
      const existing = listTsPageFileContents(app).find((f: { path: string; content: string }) => f.path === relPath)
      if (existing) {
        const className = parseClassName(existing.content)
        if (!className) {
          return NextResponse.json({ error: `Could not read a page class from "${relPath}"` }, { status: 400 })
        }
        page = { importPath: importPathFor(relPath), className }
      } else {
        const className = `${pascalCase(slug)}Page`
        try {
          await saveTsPageFile(relPath, scaffoldPageTemplate(className, app), { create: true })
        } catch (err: any) {
          return NextResponse.json({ error: err.message ?? 'Failed to scaffold page' }, { status: 400 })
        }
        page = { importPath: importPathFor(relPath), className }
      }
    }
  }

  try {
    const meta = await createProject({
      title,
      spec:
        typeof body?.spec === 'string' && body.spec.trim()
          ? body.spec
          : engine === 'appium'
            ? STARTER_SPEC_APPIUM
            : engine === 'api'
              ? starterApi(title)
              : fluentStarter(app, title, page),
      app,
      createdVia: 'manual',
      linkedTestcaseId: body?.linkedTestcaseId ?? null,
      now: new Date().toISOString(),
      engine,
      appium,
    })
    return NextResponse.json(meta, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Failed to create' }, { status: 409 })
  }
}
