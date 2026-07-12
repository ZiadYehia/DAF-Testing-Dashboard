import { defineConfig, devices } from '@playwright/test'
import path from 'path'
import { loadHubEnv } from './lib/env'

/**
 * Playwright config for the Automation Hub replay engine.
 *
 * Reruns are launched by engine/runner.ts as a child process:
 *   npx playwright test <spec> --config automation-hub/playwright.config.ts --output <runDir>
 *
 * Video + trace are always on so every replay produces artifacts the UI can show.
 * The per-run output directory is supplied on the CLI (--output), so we don't hardcode it.
 *
 * Two projects:
 *   - `setup` logs in to every registered target app (lib/apps.ts) and caches each
 *     storage state with a TTL (lib/auth.setup.ts)
 *   - `chromium` runs the actual specs; each spec opts into its app's state via
 *     test.use({ storageState: stateFor('<app>') }) and skips login
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
  ],
})
