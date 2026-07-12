/**
 * LOCKED framework file — not editable from the dashboard UI/API.
 *
 * Generic assertion helpers used INSIDE page objects' `step()` bodies. This is
 * the ONLY framework file that imports `expect` from '@playwright/test' —
 * actions.ts and data.ts stay assertion-free so a page object's "does this
 * click/fill" and "does this verify" halves are easy to tell apart at a glance.
 *
 * Ported from the assertion patterns in the framework's original Python
 * reference page objects (assert_element_visible / assert_inline_error /
 * assert_duplicate_rejected and siblings) — keep behavior in sync.
 */
import { expect, type Locator, type Page } from '@playwright/test'

/** Assert `locator` is visible. Waits automatically (default Playwright timeout when omitted). */
export async function expectVisible(locator: Locator, timeout?: number): Promise<void> {
  await expect(locator).toBeVisible({ timeout })
}

/** Assert `locator` is hidden (not visible, may still be attached). Waits automatically. */
export async function expectHidden(locator: Locator, timeout?: number): Promise<void> {
  await expect(locator).toBeHidden({ timeout })
}

/** Assert `locator` has exactly `text` as its text content. */
export async function expectText(locator: Locator, text: string | RegExp): Promise<void> {
  await expect(locator).toHaveText(text)
}

/** Assert the page URL matches `pattern` (string = substring/regex-escaped-free match via RegExp, or pass a RegExp directly). */
export async function expectUrl(page: Page, pattern: string | RegExp): Promise<void> {
  await expect(page).toHaveURL(pattern)
}

/**
 * Assert an inline field-validation error is visible.
 *
 * Rendered by the portal as `small.text-allendevaux-red-50` below the field,
 * with the standard wording `'{field} is required.'` — pass `message` for the
 * handful of fields whose live error text deviates from that pattern (e.g. the
 * base Asset Name field surfaces the generic "This field is required" instead
 * of "Asset Name is required.").
 */
export async function expectFieldError(page: Page, field: string, message?: string): Promise<void> {
  const text = message ?? `${field} is required.`
  await expect(page.getByText(text)).toBeVisible()
}

/**
 * Assert a toast/banner message containing `text` is visible. Matches the
 * FIRST element (toasts can stack) and allows extra time (15s) since toasts
 * follow a server round-trip.
 */
export async function expectToast(page: Page, text: string | RegExp): Promise<void> {
  await expect(page.getByText(text).first()).toBeVisible({ timeout: 15000 })
}
