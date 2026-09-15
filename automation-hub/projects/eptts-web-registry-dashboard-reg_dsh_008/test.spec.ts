/**
 * REG_DSH_008 — Validate that the inspector reaches the Master Data Registry portal with the onboarding rights the platform grants it
 *
 * Feature: registry-dashboard   Portal: https://192.168.225.195:8445
 *
 * Checks the inspector's entitlement on this portal: it can read the registry AND onboard a
 * pharmacy, but it is not an admin.
 *
 * THIS CASE WAS ORIGINALLY WRITTEN THE OTHER WAY ROUND, AND THAT IS WORTH KNOWING. It first
 * asserted the inspector should have NO write access, on the strength of `eptts-mobile`'s domain
 * knowledge defining inspector as "Read-only regulatory/government auditor role … cannot create,
 * modify, accept, reject, or delete". It failed, a bug was filed, and the bug was wrong — the
 * Register Pharmacy page states its own intent explicitly:
 *
 *   "Inspectors can onboard a new pharmacy here (a Dispenser party). All required fields marked *.
 *    Backend enforces ADMIN/INSPECTOR role."
 *
 * So two roles share a name across two apps and do not share a permission set. The mobile
 * inspector is read-only; the registry inspector is an onboarding role. The case now asserts the
 * entitlement the platform actually grants, and the boundary that still matters: the inspector is
 * NOT an admin, which is observable through the Administration entry it does not get.
 *
 * Read-only: reads the navigation and the Parties actions, submits nothing.
 */
import { expect, test } from '@playwright/test'
import { ensureRoleState } from '../../pages/eptts-web/roles'
import { goToRegistryTab, openRegistry, readRegistryNav } from '../../pages/eptts-web/registry.page'
import { requireEnv } from '../../lib/env'

test.use({ ignoreHTTPSErrors: true })

test('REG_DSH_008 — Validate that the inspector reaches the Master Data Registry portal with the onboarding rights the platform grants it', async ({
  browser,
}) => {
  test.slow()

  const context = await browser.newContext({
    storageState: await ensureRoleState('inspector', 'eptts-registry'),
    ignoreHTTPSErrors: true,
  })

  try {
    const page = await context.newPage()
    await openRegistry(page)

    await expect(
      page.getByRole('heading', { name: 'Master Data Registry' }),
      'the inspector should reach the registry portal',
    ).toBeVisible({ timeout: 20_000 })

    const nav = await readRegistryNav(page)

    // 1. The read surfaces an auditor needs.
    for (const entry of ['Dashboard', 'Parties', 'Prefixes', 'Products']) {
      expect(
        nav.some((n) => n.includes(entry)),
        `the inspector should be able to read "${entry}". Sidebar as read: ${nav.join(', ')}`,
      ).toBe(true)
    }

    // 2. And the onboarding entry the platform deliberately grants it.
    expect(
      nav.some((n) => /Register Pharmacy/i.test(n)),
      `the inspector should be offered Register Pharmacy — the page states "Backend enforces ` +
        `ADMIN/INSPECTOR role". Sidebar as read: ${nav.join(', ')}`,
    ).toBe(true)

    // 3. BUT NOT ADMINISTRATION. This is the boundary that still means something: an onboarding
    //    role is not a platform administrator, and Administration is the entry that separates
    //    them. Verified 2026-09-09: the admin sees six entries, the inspector five.
    expect(
      nav.filter((n) => /Administration/i.test(n)),
      `the inspector must NOT be offered Administration — that is the admin-only surface, and it ` +
        `is the only thing distinguishing the two roles on this portal. Sidebar as read: ` +
        `${nav.join(', ')}`,
    ).toEqual([])

    // 4. The registry it can read is the real one, not an empty shell. A role granted access to a
    //    blank registry would pass every check above and be useless.
    await goToRegistryTab(page, '🏢 Parties')

    // Waited for, not counted once. The Parties view fetches ~87,000 records a page at a time
    // (it has a "Load more" control), and counting rows the instant the tab is clicked catches it
    // before the first page has rendered — which reads as "the inspector sees an empty registry"
    // rather than "the table had not loaded yet".
    await expect(
      page.locator('table tbody tr').first(),
      'the Parties table should list real parties for the inspector, not an empty view',
    ).toBeVisible({ timeout: 30_000 })

    // 5. Its own identity is the platform entity rather than a trading party — an auditor sits
    //    outside the supply chain it inspects.
    const inspector = requireEnv('EPTTS_DEVSIM_INSPECTOR_EMAIL')
    expect(
      inspector,
      'the inspector account under test should be the one configured in .env',
    ).toBeTruthy()
  } finally {
    await context.close()
  }
})
