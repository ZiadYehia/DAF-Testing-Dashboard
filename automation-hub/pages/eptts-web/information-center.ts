/**
 * Information Center helpers.
 *
 * Plain functions rather than a second page object: per dashboard.page.ts there is ONE page
 * object for the shell, and per-screen CONTENT belongs to the spec that asserts it. What is
 * shared here is only the mechanics of reaching this screen's regions reliably — the things
 * that cost time to get right during discovery.
 *
 * THE THREE THINGS THAT BIT DURING DISCOVERY
 *
 *  1. **Scope to `section.section`.** Each panel is a `<section class="section">` inside
 *     `.ic-page`. Walking up from the `h3` with `closest('div').parentElement` reaches
 *     `.two-col-row` (two panels) or `.ic-page` (all five), so a "does panel X contain Y"
 *     check silently passes against the whole page. Every helper here scopes explicitly.
 *  2. **Search is server-side and debounced.** Setting the value fires a request; assertions
 *     have to wait for it, not for a fixed tick.
 *  3. **The urgent banner is not a panel.** It renders as a sibling ahead of the first
 *     `section.section`, so it is located by position in `.ic-page`, not by heading.
 */
import { expect, type Locator, type Page } from '@playwright/test'

/** Titles of the fixtures created for this feature; see the feature's knowledge.md. */
export const FIXTURES = {
  REG_001: 'QA-20260902-REG-001',
  TRN_002: 'QA-20260902-TRN-002',
  DLN_003: 'QA-20260902-DLN-003',
  SYS_004: 'QA-20260902-SYS-004',
  UGD_005: 'QA-20260902-UGD-005',
  URG_006: 'QA-20260902-URG-006',
} as const

export const ALL_TAGS = Object.values(FIXTURES)

/** Every fixture that has a saved audience, and so is expected to be visible. */
export const VISIBLE_TAGS = [
  FIXTURES.TRN_002, FIXTURES.DLN_003, FIXTURES.SYS_004,
  FIXTURES.UGD_005, FIXTURES.URG_006,
]

/** A panel, located by its heading text and scoped to its own `section.section`. */
export function panel(page: Page, heading: string): Locator {
  return page.locator('main section.section').filter({ has: page.locator('h3', { hasText: heading }) })
}

export const latestUpdates = (page: Page) => panel(page, 'Latest Updates')

/** Which fixture tags appear inside one panel. Order follows ALL_TAGS, not the DOM. */
export async function tagsIn(page: Page, heading: string): Promise<string[]> {
  const text = await panel(page, heading).innerText()
  return ALL_TAGS.filter((t) => text.includes(t))
}

/**
 * Type into the Latest Updates search box and wait for the response it triggers.
 *
 * Waits on the request rather than a sleep: the input is debounced, so a fixed wait is either
 * flaky or slow. An empty value still fires a request (the unfiltered reload).
 */
export async function search(page: Page, value: string): Promise<void> {
  const box = latestUpdates(page).locator('input').first()
  await box.waitFor({ state: 'visible', timeout: 20_000 })
  const settled = page.waitForResponse(
    (r) => r.url().includes('/information-center/announcements') && r.status() === 200,
    { timeout: 20_000 },
  ).catch(() => null)
  await box.fill(value)
  await settled
  await page.waitForTimeout(600)
}

/** Select a category by its display label, and wait for the filtered response. */
export async function chooseCategory(page: Page, label: string): Promise<void> {
  await latestUpdates(page).locator('[role=combobox]').click()
  const option = page.locator('[role=option]', { hasText: new RegExp(`^\\s*${label}\\s*$`) }).first()
  await option.waitFor({ state: 'visible', timeout: 10_000 })
  const settled = page.waitForResponse(
    (r) => r.url().includes('/information-center/announcements') && r.status() === 200,
    { timeout: 20_000 },
  ).catch(() => null)
  await option.click()
  await settled
  await page.waitForTimeout(600)
}

/** Clear the category filter via its clear icon. Returns false when no icon is rendered. */
export async function clearCategory(page: Page): Promise<boolean> {
  const icon = latestUpdates(page).locator('.p-select-clear-icon').first()
  if (await icon.count() === 0) return false
  const settled = page.waitForResponse(
    (r) => r.url().includes('/information-center/announcements') && r.status() === 200,
    { timeout: 20_000 },
  ).catch(() => null)
  await icon.click()
  await settled
  await page.waitForTimeout(600)
  return true
}

/** The Latest Updates panel is showing its empty state. */
export async function showsEmptyState(page: Page): Promise<boolean> {
  return (await latestUpdates(page).innerText()).includes('No announcements found')
}

/**
 * Text rendered in `.ic-page` ahead of the first panel — i.e. the urgent banner region.
 *
 * Located by position because the banner carries no heading of its own, so there is nothing
 * to filter on.
 */
export async function urgentBannerText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const icPage = document.querySelector('main .ic-page')
    if (!icPage) return ''
    const firstSection = icPage.querySelector('section.section')
    const out: string[] = []
    for (const child of Array.from(icPage.children)) {
      if (child === firstSection || child.contains(firstSection)) break
      out.push((child as HTMLElement).innerText ?? '')
    }
    return out.join(' ').replace(/\s+/g, ' ').trim()
  })
}

/** Open one announcement's read-only detail dialog by its title fragment. */
export async function openDetail(page: Page, tag: string): Promise<Locator> {
  await latestUpdates(page).getByText(tag, { exact: false }).first().click()
  const dialog = page.locator('.p-dialog')
  await dialog.waitFor({ state: 'visible', timeout: 15_000 })
  return dialog
}

/** Assert a panel contains exactly the given fixtures and nothing else from ALL_TAGS. */
export async function expectPanelHolds(page: Page, heading: string, expected: string[]): Promise<void> {
  const actual = await tagsIn(page, heading)
  expect(actual.sort(), `"${heading}" holds exactly ${expected.join(', ') || '(nothing)'}`)
    .toEqual([...expected].sort())
}
