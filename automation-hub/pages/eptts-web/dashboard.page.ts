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
   * CSS for the currently-selected tab's panel, once a tab has been opened.
   *
   * Assertions scope to it so they read the right tab's content. Without this they match the
   * first table on the page, which on a multi-tab screen is whichever tab happened to render
   * first — during discovery that put the Pharmacies columns under Geography.
   */
  private panelSelector: string | null = null

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
   * Open a route and select one of its tabs.
   *
   * PrimeNG tab bars needed three attempts to drive reliably during discovery, and each
   * lesson is encoded here:
   *
   *  - **Match on trimmed text.** `p-tab` renders its label with a LEADING SPACE, so an
   *    anchored regex or an exact accessible-name match silently finds nothing.
   *  - **Click via the DOM, not the mouse.** The Settings page stacks five tab bars, and
   *    Playwright's actionability wait (`scrollIntoViewIfNeeded`) times out on the ones below
   *    the fold. A direct `.click()` in page context selects the tab without needing it in
   *    view.
   *  - **Scope by `aria-controls`.** Taking "the last visible tabpanel" instead attributes
   *    one tab's table to another, which is how Pharmacies' columns were once recorded under
   *    Geography.
   */
  static openTab(page: Page, route: string, tabLabel: string): DashboardPage {
    const self = new DashboardPage(page)
    return self.step(async () => {
      await ensureLoggedIn(page, 'eptts-web', route)
      await page.locator('nav, aside, [class*="layout-menu"]').first()
        .waitFor({ state: 'visible', timeout: 45_000 })
      await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})

      const result = await page.evaluate((label: string) => {
        const wanted = label.trim().toLowerCase()
        const textOf = (el: Element) => ((el as HTMLElement).innerText || el.textContent || '').trim()

        // 1. ARIA tabs. /admin stacks FIVE separate bars (15 tabs), so this searches all of
        //    them, not just the first.
        const aria = [...document.querySelectorAll('[role="tab"], p-tab')]
        const hit = aria.find((t) => textOf(t).toLowerCase() === wanted)
        if (hit) {
          ;(hit as HTMLElement).click()
          return {
            kind: 'aria' as const,
            panelId: hit.getAttribute('aria-controls'),
            // More than one bar can carry the same label — /admin has "System Configuration"
            // twice — so report it rather than silently taking the first.
            duplicates: aria.filter((t) => textOf(t).toLowerCase() === wanted).length,
          }
        }

        // 2. A tab strip that is NOT ARIA. /analytics renders a plain `.tabs` element whose
        //    children are the tabs; there is no role, and therefore no panel to scope to.
        const strips = [...document.querySelectorAll('[class*="tab"]')]
          .filter((e) => e.children.length > 1)
        for (const strip of strips) {
          const child = [...strip.children].find((c) => textOf(c).toLowerCase() === wanted)
          if (child) {
            ;(child as HTMLElement).click()
            return { kind: 'plain' as const, panelId: null, duplicates: 1 }
          }
        }

        return {
          kind: 'missing' as const,
          panelId: null,
          duplicates: 0,
          seen: [
            ...aria.map(textOf),
            ...strips.flatMap((s2) => [...s2.children].map(textOf)),
          ].filter(Boolean).slice(0, 25),
        }
      }, tabLabel)

      if (result.kind === 'missing') {
        throw new Error(
          `tab "${tabLabel}" not found on ${route}. Tabs seen: ` +
          `${(result as { seen: string[] }).seen.map((t) => `"${t}"`).join(', ') || '(none)'}`,
        )
      }

      if (result.kind === 'aria' && result.duplicates > 1) {
        // Ambiguity is worth saying out loud rather than resolving silently: /admin uses
        // "System Configuration" for two different tabs, so "the first match" is a coin toss
        // between them and the spec cannot say which one it meant.
        console.warn(
          `[dashboard] "${tabLabel}" matches ${result.duplicates} tabs on ${route}; took the ` +
          'first. If they are different screens, the label cannot identify one unambiguously.',
        )
      }

      await page.waitForTimeout(1200)
      await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})

      if (result.kind === 'aria' && result.panelId) {
        // WAIT ON aria-selected, NOT ON THE PANEL BEING VISIBLE.
        //
        // PrimeNG marks the tab selected immediately but renders the panel's contents lazily,
        // so the panel legitimately measures zero-height for a moment after the click.
        // Treating that as "the tab did not switch" fails tabs that are working — measured on
        // /admin, where Geography, User Locks and B2B Partners all reported aria-selected=true
        // with a zero-height panel at the same instant.
        //
        // Waiting on the selected state is the accurate signal for "the tab switched"; the
        // panel's contents are then awaited by whichever assertion needs them.
        const selected = await page
          .waitForFunction(
            (id: string) => {
              const tab = [...document.querySelectorAll('[role="tab"], p-tab')]
                .find((t) => t.getAttribute('aria-controls') === id)
              return tab?.getAttribute('aria-selected') === 'true'
            },
            result.panelId,
            { timeout: 20_000 },
          )
          .then(() => true)
          .catch(() => false)

        if (!selected) {
          throw new Error(
            `tab "${tabLabel}" was clicked but never became selected (panel ` +
            `#${result.panelId}), so the tab did not switch. Refusing to assert against ` +
            'whatever else is on screen.',
          )
        }
        self.panelSelector = `#${result.panelId}`
      } else {
        // A non-ARIA strip has no panel to scope to; the tab view replaces the main content,
        // so page-level assertions are the right scope here.
        self.panelSelector = null
      }
    })
  }

  /** The active tab's panel when one is open, else the whole page. */
  private scope(): Locator {
    return this.panelSelector
      ? this.page.locator(this.panelSelector).first()
      : this.page.locator('body')
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
        this.scope().getByRole('heading', { name: text }).first(),
        `heading "${text}" is displayed`,
      ).toBeVisible({ timeout: 20_000 })
    })
  }

  /** Assert each named control is present. */
  expectControls(names: string[]): this {
    return this.step(async () => {
      for (const name of names) {
        await expect(
          this.scope().getByRole('button', { name, exact: false }).first(),
          `control "${name}" is present`,
        ).toBeVisible({ timeout: 15_000 })
      }
    })
  }

  /** Assert the first data table carries these column headers, in any order. */
  expectTableColumns(columns: string[]): this {
    return this.step(async () => {
      const table = this.scope().locator('table').first()
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
