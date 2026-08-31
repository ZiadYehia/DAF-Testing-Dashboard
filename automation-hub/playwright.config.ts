import { defineConfig, devices } from '@playwright/test'
import path from 'path'
import { loadHubEnv } from './lib/env'

/**
 * Playwright config for the Automation Hub replay engine.
 *
 * Reruns are launched by engine/runner.ts as a child process:
 *   npx playwright test <spec> --config automation-hub/playwright.config.ts
 *     --project <chromium|api> --output <runDir>
 *
 * `--project` is NOT optional. `chromium` and `api` share a testMatch, so omitting it
 * selects both and runs every spec twice. engine/runner.ts always passes it; if you run
 * the CLI by hand, pass it too.
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
      testMatch: /projects[\\/].*test\.spec\.ts/,
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
     * NOTE: this shares `chromium`'s testMatch, so it is selected exclusively via
     * `--project=api` from engine/runner.ts. Running the CLI by hand without --project
     * matches both projects and runs every spec twice.
     */
    {
      name: 'api',
      testMatch: /projects[\\/].*test\.spec\.ts/,
      use: { video: 'off', trace: 'off', screenshot: 'off', ignoreHTTPSErrors: true },
    },
  ],
})
