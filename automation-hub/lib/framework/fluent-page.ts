/**
 * LOCKED framework file — not editable from the dashboard UI/API.
 *
 * Fluent chain core shared by every TS page object (automation-hub/pages/<app>/*.page.ts).
 *
 * Playwright actions are async, but the user-facing test API is a TRUE fluent chain:
 *   await AssetCreatePage.open(page).selectFamily('Evidence').fillAssetName(name).create()
 * Every public page method queues its work onto a promise chain and returns `this`
 * (or the next page object) SYNCHRONOUSLY — nothing actually runs until the single
 * `await` at the head of the chain, which drains the queue through `then()` below.
 *
 * Thenable-assimilation trap: page entry points (`static open(page)`) MUST be a
 * plain sync function returning a FluentPage instance, never `async`. An `async`
 * function whose return value is a thenable (FluentPage implements `then`) gets
 * unwrapped by the JS runtime before the caller ever sees it, so
 * `await AssetCreatePage.open(page)` would resolve to `void` instead of the page
 * object, and the following `.selectFamily(...)` call would throw on `undefined`.
 * Example (see pages/<app>/*.page.ts for real usage):
 *
 *   static open(page: Page): AssetCreatePage {
 *     return new AssetCreatePage(page).step(() => ensureLoggedIn(page, 'grc', '/grc/assets/create'))
 *   }
 *
 * An un-awaited chain still fails loudly: a rejected step becomes an unhandled
 * promise rejection, which fails the Playwright worker regardless. Codegen/starter
 * templates always emit the `await` at the test level — that's the accepted
 * mitigation for this file's one sharp edge (see the approved plan's Risks section).
 */
import type { Page } from '@playwright/test'

export abstract class FluentPage {
  protected chain: Promise<void>

  constructor(readonly page: Page, chain: Promise<void> = Promise.resolve()) {
    this.chain = chain
  }

  /** Queue a step; every public page method is `return this.step(async () => {...})`. */
  protected step(fn: () => Promise<void>): this {
    this.chain = this.chain.then(fn)
    return this
  }

  /**
   * Queue a step, then continue the chain on the NEXT page object (a cross-page
   * transition, e.g. the create wizard's `create()` handing off to the details
   * page). `make` receives this page's `Page` handle plus the still-pending chain
   * so the new object's own steps queue strictly after `fn` resolves.
   */
  protected stepTo<T extends FluentPage>(
    make: (page: Page, chain: Promise<void>) => T,
    fn: () => Promise<void>,
  ): T {
    return make(this.page, this.chain.then(fn))
  }

  /** Thenable: one `await` at the chain head settles every queued step, errors propagate. */
  then<T1 = void, T2 = never>(
    onfulfilled?: ((value: void) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
  ): Promise<T1 | T2> {
    return this.chain.then(onfulfilled, onrejected)
  }
}
