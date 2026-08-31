/**
 * Setup project: authenticate against every registered target app and cache each
 * browser storage state at .auth/<slug>.json. Specs opt in with
 * `test.use({ storageState: stateFor('<slug>') })` and skip login entirely.
 *
 * States are reused across replays until older than AUTH_STATE_TTL_MIN (default 30
 * minutes). An app whose env isn't configured, or whose login fails, gets an EMPTY
 * state so unrelated apps' replays still run — its own specs then fail on auth with
 * the real cause in this setup's console output.
 */
import fs from 'fs'
import path from 'path'
import { test as setup } from '@playwright/test'
import { TARGET_APPS, stateFor } from './apps'

const TTL_MIN = Number(process.env.AUTH_STATE_TTL_MIN ?? 30)
const EMPTY_STATE = JSON.stringify({ cookies: [], origins: [] })

setup('authenticate target apps', async ({ browser }) => {
  for (const app of TARGET_APPS) {
    const statePath = stateFor(app.slug)
    try {
      const stat = fs.statSync(statePath)
      if (Date.now() - stat.mtimeMs < TTL_MIN * 60_000) continue // still fresh
    } catch {
      /* no cached state yet */
    }
    fs.mkdirSync(path.dirname(statePath), { recursive: true })

    if (!process.env[app.baseUrlEnv]) {
      fs.writeFileSync(statePath, EMPTY_STATE)
      continue // app not configured in this environment
    }

    // ignoreHTTPSErrors: some targets (eptts-web on the production host) serve a
    // self-signed certificate. browser.newContext() does NOT inherit the config's
    // `use` options, so it has to be set explicitly here or the handshake fails.
    const context = await browser.newContext({ ignoreHTTPSErrors: true })
    try {
      const page = await context.newPage()
      await app.login(page)
      await context.storageState({ path: statePath })
    } catch (err) {
      console.error(`[auth.setup] login failed for "${app.slug}": ${err}`)
      fs.writeFileSync(statePath, EMPTY_STATE)
    } finally {
      await context.close()
    }
  }
})
