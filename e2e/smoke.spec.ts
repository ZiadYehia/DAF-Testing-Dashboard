import { test, expect } from '@playwright/test'

const EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@allendevaux.com'
const PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? ''

test('login lands on an app and bugs/features pages render', async ({ page }) => {
  await page.goto('/login')
  await page.fill('#email', EMAIL)
  await page.fill('#password', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))

  // First enabled app from the live registry (DB-backed) — avoids hardcoding a slug.
  const res = await page.request.get('/api/apps')
  expect(res.ok()).toBeTruthy()
  const apps = (await res.json()) as { slug: string }[]
  const firstApp = apps[0]?.slug

  if (firstApp) {
    await page.goto(`/${firstApp}/bugs`)
    await expect(page.getByRole('heading', { name: 'Bug Reports' })).toBeVisible()
    await page.goto(`/${firstApp}/features`)
    await expect(page).not.toHaveURL(/\/login/)
  } else {
    // Admin with zero enabled apps is sent to the admin apps list.
    await page.goto('/admin/apps')
    await expect(page).not.toHaveURL(/\/login/)
  }
})
