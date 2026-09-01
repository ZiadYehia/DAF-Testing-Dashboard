import { defineConfig, devices } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { loadHubEnv } from './lib/env'

/**
 * Playwright config for the Automation Hub replay engine.
 *
 * Reruns are launched by engine/runner.ts as a child process:
 *   npx playwright test <spec> --config automation-hub/playwright.config.ts
 *     --project <chromium|api> --output <runDir>
 *
 * Each project selects its own specs by engine (see specsForEngine), so a project never
 * picks up another engine's tests. Still pass `--project`: with none given Playwright runs
 * every project, which is rarely what you want. engine/runner.ts always passes it.
 *
 * Video + trace are on globally so browser replays produce artifacts the UI can show; the
 * `api` project turns them back off. The per-run output directory comes from --output.
 *
 * Three projects:
 *   - `setup`    logs in to every registered target app (lib/apps.ts) and caches each
 *                storage state with a TTL (lib/auth.setup.ts)
 *   - `chromium` browser specs; each opts into its app's state via
 *                test.use({ storageState: stateFor('<app>') }) and skips login
 *   - `api`      HTTP-only specs — no browser, no login dependency, no artifacts
 */

// Secrets/base URLs live in automation-hub/.env — load them for the whole child process.
loadHubEnv()

/**
 * The spec files belonging to one engine family, read from each project's own meta.json.
 *
 * `chromium` and `api` used to share the pattern `projects/<any>/test.spec.ts`, which meant
 * `--project=api` selected EVERY project — all 340 dashboard specs included — and ran them
 * with no browser. They do not fail informatively when that happens; they sit there until
 * something times out, so a "run the API suite" command quietly becomes a 712-test run that
 * takes many times longer and reports nonsense for two thirds of it.
 *
 * Deriving the file list from `engine` makes each project select exactly its own specs, so a
 * bare `npx playwright test --project=api` is now correct on its own.
 */
function specsForEngine(family: 'browser' | 'api'): RegExp[] | string[] {
  const root = path.join(__dirname, 'projects')
  if (!fs.existsSync(root)) return [/(?!)/]

  const specs: string[] = []
  for (const name of fs.readdirSync(root)) {
    let engine: string | undefined
    try {
      engine = JSON.parse(fs.readFileSync(path.join(root, name, 'meta.json'), 'utf8')).engine
    } catch {
      // A project with no readable meta is a browser project — that is what every project
      // was before the `api` engine existed, and guessing 'api' would skip its login setup.
    }
    if ((family === 'api') === (engine === 'api')) specs.push(`projects/${name}/test.spec.ts`)
  }
  // An empty array is treated by Playwright as "no filter", i.e. match everything — the
  // opposite of what an empty set means. Return a regex that cannot match instead.
  return specs.length ? specs : [/(?!)/]
}

export default defineConfig({
  testDir: __dirname,

  // Replays run one project at a time — no parallelism. One retry absorbs
  // one-off flakes; a genuine failure still fails the run.
  fullyParallel: false,
  workers: 1,
  retries: 1,

  // A single replay should never hang the server.
  timeout: 60_000,
  expect: { timeout: 10_000 },

  reporter: [['json'], ['list']],

  use: {
    headless: true,
    video: 'on',
    trace: 'on',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
  },

  projects: [
    {
      name: 'setup',
      testMatch: /lib[\\/]auth\.setup\.ts/,
      // No artifacts for the login bootstrap — the runner lifts the first video it
      // finds into the run history, which must be the spec's, not the login's.
      use: { video: 'off', trace: 'off', screenshot: 'off' },
    },
    {
      name: 'chromium',
      testMatch: specsForEngine('browser'),
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'] },
    },
    /**
     * API projects (ProjectMeta.engine === 'api'): pure APIRequestContext, no browser.
     *
     * No `dependencies` — the `setup` login bootstrap opens a browser and caches storage
     * state, which an HTTP-only test has no use for. Artifacts off for the same reason:
     * a browser video of a test that never opened a page is noise. The request/response
     * log these projects DO produce is emitted by lib/eptts-api-log.ts and lifted by
     * engine/runner.ts.
     *
     * `ignoreHTTPSErrors` is required, not optional: the EPTTS production host serves a
     * self-signed certificate. Specs that build their own context (lib/eptts-api.ts) pass
     * it themselves, but one using the plain `request` fixture inherits it from here.
     *
     * Its spec list is derived from each project's `engine`, so `--project=api` runs the
     * API specs and nothing else.
     */
    {
      name: 'api',
      testMatch: specsForEngine('api'),
      use: { video: 'off', trace: 'off', screenshot: 'off', ignoreHTTPSErrors: true },
    },
  ],
})
