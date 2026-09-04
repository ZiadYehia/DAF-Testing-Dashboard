#!/usr/bin/env node
/**
 * End-to-end check of the Automation Hub's filter levels against a running app.
 *
 * Drives a real browser through scope (modules) / state (status) / refine (tags),
 * then asserts the behaviours that are easy to break and invisible in a unit test:
 * every scope option reachable without sideways scrolling, counts cascading between
 * levels, scope persisting across a reload while state and tags reset, a stored scope
 * pointing at a deleted module healing itself, the legacy single-value storage key
 * migrating, and folders still collapsing while a filter is active.
 *
 * Usage:
 *   npm run dev                                   # in another terminal
 *   npm run verify:filters                        # defaults: grc @ http://localhost:3000
 *   VERIFY_APP=eptts-web VERIFY_BASE=http://localhost:3100 npm run verify:filters
 *   VERIFY_SHOT=/tmp/hub.png npm run verify:filters   # also save a screenshot
 *
 * Read-only against the app: it filters, collapses and reloads, but creates, edits
 * and deletes nothing. It does write the viewer's own localStorage (that is what the
 * persistence checks exercise) and signs in with SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD
 * from .env.local, so point it at a local dev server, never a shared environment.
 */
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const APP = process.env.VERIFY_APP ?? 'grc'
const BASE = process.env.VERIFY_BASE ?? 'http://localhost:3000'
const SHOT = process.env.VERIFY_SHOT ?? ''
const KEY = `automation-modules-${APP}`
const LEGACY_KEY = `automation-module-${APP}`
const FOLDERS_KEY = `automation-folders-${APP}`

const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^"|"$/g, '')]),
)

const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } })

/** Load the hub, signing in on the way if the dev session has expired. */
async function open() {
  await page.goto(`${BASE}/${APP}/automation`, { waitUntil: 'domcontentloaded' })
  if (/login/.test(page.url())) {
    // The form needs to hydrate before it will take a programmatic submit.
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2500)
    await page.fill('#email', env.SEED_ADMIN_EMAIL)
    await page.fill('#password', env.SEED_ADMIN_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL(/automation/, { timeout: 30000 })
  }
  // The module and feature registries land after the list itself.
  await page.waitForTimeout(6000)
}

const badge = () => page.locator('h2:has-text("Automations")').locator('xpath=following-sibling::span[1]').innerText()
const pills = () => page.locator('button[title^="Remove filter"]').allInnerTexts()
const cards = () => page.locator('h3.truncate').count()
const stored = (key = KEY) => page.evaluate((k) => localStorage.getItem(k), key)
const scopeTrigger = page.locator('button[title^="Scope the list"]')

const columnScrollsSideways = () => page.evaluate(() => {
  const col = document.querySelector('.min-w-0.overflow-x-hidden')
  return col ? col.scrollWidth > col.clientWidth : null
})

/** Reopening can race the previous Escape — retry until the options are really there. */
async function openScope() {
  for (let i = 0; i < 3; i++) {
    if (await page.locator('[role="menuitemcheckbox"]').count() > 0) return
    await scopeTrigger.click()
    await page.waitForTimeout(800)
  }
}

await open()

// 1 — every scope option reachable, nothing clipped, no sideways scroll
await openScope()
const options = await page.locator('[role="menuitemcheckbox"], [role="menuitem"]').allInnerTexts()
const clipped = await page.evaluate(() =>
  [...document.querySelectorAll('[role="menuitemcheckbox"]')].some((r) => r.scrollWidth > r.clientWidth + 1))
await page.keyboard.press('Escape')
await page.waitForTimeout(300)
console.log('1  scope options:', JSON.stringify(options))
console.log('1  none clipped:', !clipped, '| column scrolls sideways:', await columnScrollsSideways(), '| badge:', await badge())

// 2 — scope is multi-select and persists
await openScope()
const boxes = page.locator('[role="menuitemcheckbox"]')
const picked = [
  (await boxes.nth(0).innerText()).replace(/\s*\d+$/, ''),
  (await boxes.nth(1).innerText()).replace(/\s*\d+$/, ''),
]
await boxes.nth(0).click()
await page.waitForTimeout(400)
await boxes.nth(1).click()
await page.waitForTimeout(400)
await page.keyboard.press('Escape')
await page.waitForTimeout(600)
console.log('2  picked:', JSON.stringify(picked), '| trigger:', await scopeTrigger.innerText())
console.log('2  badge:', await badge(), '| pills:', JSON.stringify(await pills()), '| stored:', await stored())

// 3 — state narrows within the chosen scope
await page.locator('button[title^="Fail"]').click()
await page.waitForTimeout(700)
console.log('3  state=Failing - badge:', await badge(), '| pills:', JSON.stringify(await pills()))
await page.locator('button[title^="All"]').click()
await page.waitForTimeout(500)

// 4 — tags: type-to-filter (the menu's typeahead must not eat the keystrokes),
//     multi-select without the popover closing
await page.locator('button', { hasText: /^Tags/ }).first().click()
await page.waitForTimeout(600)
const tagInput = page.locator('input[placeholder="Filter tags…"]')
if (await tagInput.count() > 0) {
  const term = (await page.locator('[role="menuitemcheckbox"]').first().innerText()).replace(/\d+$/, '').slice(0, 4)
  await tagInput.pressSequentially(term)
  await page.waitForTimeout(500)
  console.log('4  typed', JSON.stringify(term), '-> rows:', JSON.stringify(await page.locator('[role="menuitemcheckbox"]').allInnerTexts()))
  await page.locator('[role="menuitemcheckbox"]').first().click()
  await page.waitForTimeout(600)
  const stillOpen = await tagInput.count() > 0
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  console.log('4  popover stayed open:', stillOpen, '| trigger:', await page.locator('button', { hasText: /^Tags/ }).first().innerText())
  console.log('4  badge:', await badge(), '| pills:', JSON.stringify(await pills()))
} else {
  console.log('4  no tags in this scope')
}

// 5 — reload: scope survives, state and tags do not
await open()
console.log('5  after reload - badge:', await badge(), '| stored:', await stored(), '| pills:', JSON.stringify(await pills()))

// 6 — clear everything
const clearAll = page.locator('button', { hasText: /^Clear all$/ })
if (await clearAll.count() > 0) {
  await clearAll.click()
  await page.waitForTimeout(600)
} else {
  for (const pill of await page.locator('button[title^="Remove filter"]').all()) {
    await pill.click()
    await page.waitForTimeout(300)
  }
}
console.log('6  cleared - badge:', await badge(), '| stored:', await stored(), '| pills:', (await pills()).length)

// 7 — a stored scope whose module is gone must heal, not show an empty list
await page.evaluate((k) => localStorage.setItem(k, JSON.stringify(['module-that-was-deleted'])), KEY)
await open()
console.log('7  stale scope - badge:', await badge(), '| stored:', await stored())

// 8 — the pre-multi-select storage key migrates
await page.evaluate(([k, l]) => {
  localStorage.removeItem(k)
  localStorage.setItem(l, 'nope-not-a-module')
}, [KEY, LEGACY_KEY])
await open()
console.log('8  legacy key - new:', await stored(), '| legacy left:', await stored(LEGACY_KEY))

// 9 — folders still collapse while filtered, without touching the persisted prefs
await openScope()
await page.locator('[role="menuitemcheckbox"]').first().click()
await page.keyboard.press('Escape')
await page.waitForTimeout(900)
const foldersBefore = await stored(FOLDERS_KEY)
const folderHeader = page.locator('button').filter({ hasText: /^[A-Z].*\d+$/ }).nth(0)
const openCards = await cards()
await folderHeader.click()
await page.waitForTimeout(700)
const collapsedCards = await cards()
await folderHeader.click()
await page.waitForTimeout(700)
const reExpanded = await cards()
console.log('9  collapse while filtered:', openCards, '->', collapsedCards, '->', reExpanded,
  '| collapsed something:', collapsedCards < openCards,
  '| unfiltered prefs untouched:', foldersBefore === await stored(FOLDERS_KEY))

if (SHOT) {
  await page.screenshot({ path: SHOT })
  console.log('   screenshot:', SHOT)
}

await browser.close()
