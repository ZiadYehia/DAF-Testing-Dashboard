/**
 * Page object for the EPTTS Web dashboard.
 *
 * ONE page object, not forty-one. Every screen in this app is the same Angular shell with a
 * different route: the same header, the same sidebar, the same table/toolbar idiom. What
 * differs per page is content, and content belongs in the spec that asserts it. Forty-one
 * near-identical classes would be forty-one places to fix the day the shell changes.
 *
 * THE LANGUAGE IS PART OF THE CONTRACT
 *
 * The dashboard is bilingual and DEFAULTS TO ARABIC (dir=rtl, lang=ar). Specs are written
 * against English labels, so a spec running against an Arabic page fails on a locator rather
 * than on its subject — which reads as a broken test, not a mis-set locale, and costs real
 * time to diagnose.
 *
 * English is established once, in the login flow (data/eptts-web/automation.json), and cached
 * in the storage state via `localStorage.lang`. `open()` VERIFIES it rather than trusting it,
 * so if that ever stops working the failure says exactly that.
 */
import { expect, type Locator, type Page } from '@playwright/test'
import { FluentPage } from '../../lib/framework/fluent-page'
import { ensureLoggedIn } from '../../lib/auth'

/** A raw i18n key that leaked into the UI, e.g. "shipments.bulkUpload". */
const RAW_TRANSLATION_KEY = /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)+$/

export class DashboardPage extends FluentPage {
  /**
   * Open a dashboard route, logged in and in English.
   *
   * Must stay a plain sync function returning the instance — see the thenable-assimilation
   * note in lib/framework/fluent-page.ts. An `async` version would be unwrapped by the
   * runtime and the caller would get `void`.
   */
  static open(page: Page, route: string): DashboardPage {
    return new DashboardPage(page).step(async () => {
      await ensureLoggedIn(page, 'eptts-web', route)
      // Angular renders after navigation settles; the shell is the earliest reliable signal.
      await page.locator('nav, aside, [class*="layout-menu"]').first()
        .waitFor({ state: 'visible', timeout: 45_000 })
      await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
    })
  }

  /**
   * Assert the UI really is in English.
   *
   * Checked against `dir`/`lang` rather than by looking for an English word, because a page
   * with no text yet would pass a word check by accident.
   */
  expectEnglish(): this {
    return this.step(async () => {
      const { dir, lang } = await this.page.evaluate(() => ({
        dir: document.documentElement.getAttribute('dir'),
        lang: document.documentElement.getAttribute('lang'),
      }))
      expect(
        dir,
        'the dashboard must be in English (dir=ltr). It defaults to Arabic; the EN switch lives ' +
        'in data/eptts-web/automation.json and is cached in the storage state as localStorage.lang',
      ).toBe('ltr')
      expect(lang, 'document language').toBe('en')
    })
  }

  /** Assert the page's main heading. */
  expectHeading(text: string | RegExp): this {
    return this.step(async () => {
      await expect(
        this.page.getByRole('heading', { name: text }).first(),
        `heading "${text}" is displayed`,
      ).toBeVisible({ timeout: 20_000 })
    })
  }

  /** Assert each named control is present. */
  expectControls(names: string[]): this {
    return this.step(async () => {
      for (const name of names) {
        await expect(
          this.page.getByRole('button', { name, exact: false }).first(),
          `control "${name}" is present`,
        ).toBeVisible({ timeout: 15_000 })
      }
    })
  }

  /** Assert the first data table carries these column headers, in any order. */
  expectTableColumns(columns: string[]): this {
    return this.step(async () => {
      const table = this.page.locator('table').first()
      await expect(table, 'a data table is rendered').toBeVisible({ timeout: 20_000 })
      const headers = (await table.locator('thead th, thead td').allInnerTexts())
        .map((h) => h.replace(/\s+/g, ' ').trim().toUpperCase())
        .filter(Boolean)
      for (const c of columns) {
        expect(headers, `column "${c}" is present (got: ${headers.join(', ')})`)
          .toContain(c.toUpperCase())
      }
    })
  }

  /**
   * Assert no raw i18n key is rendered as a label.
   *
   * This is a real defect on this app, not a hypothetical: /shipments ships a button reading
   * `shipments.bulkUpload` in both locales. Worth checking on every page because a missing
   * translation is invisible to a locator-based test that happens not to touch that control.
   */
  expectNoRawTranslationKeys(): this {
    return this.step(async () => {
      const labels = await this.page.locator('button, a[role="button"], h1, h2, h3').allInnerTexts()
      const leaked = labels
        .map((t) => t.replace(/\s+/g, ' ').trim())
        .filter((t) => t && RAW_TRANSLATION_KEY.test(t))
      const keys = [...new Set(leaked)]
      // The message names what was found, not just what was expected: it becomes the failure
      // note recorded against the test case, and "the issue found" is what that note is for.
      expect(
        keys,
        keys.length
          ? `untranslated i18n key(s) rendered as UI labels instead of text: ${keys.join(', ')} ` +
            '— the control gives the user no indication of what it does'
          : 'no untranslated i18n keys are rendered as labels',
      ).toEqual([])
    })
  }

  /** Assert the page did not surface a backend error to the user. */
  expectNoErrorBanner(): this {
    return this.step(async () => {
      const body = await this.page.locator('body').innerText()
      const firstScreenful = body.replace(/\s+/g, ' ').slice(0, 600)
      expect(
        firstScreenful,
        'the page shows no raw backend error',
      ).not.toMatch(/Cannot GET this resource|Something went wrong|Internal Server Error/i)
    })
  }

  /** Escape hatch for a page-specific assertion the shared vocabulary does not cover. */
  locator(selector: string): Locator {
    return this.page.locator(selector)
  }
}
