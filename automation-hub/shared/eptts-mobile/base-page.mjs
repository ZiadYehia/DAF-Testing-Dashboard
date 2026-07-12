import { TIMEOUTS } from './config.mjs'

/**
 * Base class for all Page Objects.
 *
 * Locator conventions:
 *   '~SomeText'   → accessibility id (content-desc) — preferred for Flutter widgets
 *   '//xpath'     → XPath — used for Keycloak WebView elements
 *   'id:...'      → resource-id
 */
export class BasePage {
  constructor(driver) {
    this.driver = driver
  }

  /** Subclasses must implement a wait-for-loaded guard. */
  async waitForLoaded() {
    throw new Error('waitForLoaded() not implemented')
  }

  // ── Element interactions ────────────────────────────────────────────────────

  /** Waits until the element is visible, then taps it. */
  async tap(selector) {
    const el = await this.driver.$(selector)
    await el.waitForDisplayed({ timeout: TIMEOUTS.element })
    await el.click()
  }

  /** Waits, clears, then types into an input. */
  async setText(selector, value) {
    const el = await this.driver.$(selector)
    await el.waitForDisplayed({ timeout: TIMEOUTS.element })
    await el.clearValue()
    await el.setValue(value)
  }

  /** Returns the trimmed text content of an element. */
  async getText(selector) {
    const el = await this.driver.$(selector)
    await el.waitForDisplayed({ timeout: TIMEOUTS.element })
    return (await el.getText()).trim()
  }

  /** Returns true if the element is currently displayed on screen. */
  async isDisplayed(selector) {
    try {
      const el = await this.driver.$(selector)
      return el.isDisplayed()
    } catch {
      return false
    }
  }

  /** Returns true if the element exists (not necessarily visible). */
  async exists(selector) {
    try {
      const el = await this.driver.$(selector)
      return el.isExisting()
    } catch {
      return false
    }
  }

  // ── Waits ───────────────────────────────────────────────────────────────────

  /** Waits until the element exists and is visible. */
  async waitForElement(selector, timeout = TIMEOUTS.element) {
    const el = await this.driver.$(selector)
    await el.waitForDisplayed({ timeout })
    return el
  }

  /** Waits until the element exists (not necessarily visible). */
  async waitForExist(selector, timeout = TIMEOUTS.element) {
    const el = await this.driver.$(selector)
    await el.waitForExist({ timeout })
    return el
  }

  // ── Navigation ──────────────────────────────────────────────────────────────

  /** Presses the Android back button. */
  async pressBack() {
    await this.driver.back()
  }

  /** Takes a screenshot. Path relative to cwd. */
  async screenshot(filename) {
    await this.driver.saveScreenshot(filename)
  }

  // ── Fluent assertions ───────────────────────────────────────────────────────

  /**
   * Asserts that the element identified by `~tileName` (accessibility id) is
   * visible, then returns `this` so callers can chain further assertions.
   *
   * Usage:
   *   const home = await landing
   *     .verifyTileVisible('Receive Invoice')
   *     .then(p => p.verifyTileVisible('Dispense'))
   */
  async verifyTileVisible(tileName) {
    const el = await this.driver.$(`~${tileName}`)
    await el.waitForDisplayed({ timeout: TIMEOUTS.element })
    return this
  }

  // ── Scrolling ────────────────────────────────────────────────────────────────

  /**
   * Scrolls down one viewport height. wdio v9 removed `driver.touchAction()`
   * — rewritten on top of the W3C-actions-based `mobile: scrollGesture`.
   */
  async scrollDown() {
    const { width, height } = await this.driver.getWindowSize()
    await this.driver.execute('mobile: scrollGesture', {
      left: Math.floor(width * 0.1),
      top: Math.floor(height * 0.2),
      width: Math.floor(width * 0.8),
      height: Math.floor(height * 0.6),
      direction: 'down',
      percent: 0.8,
    })
  }

  /** Pauses for the given milliseconds (use sparingly). */
  async pause(ms = TIMEOUTS.pause) {
    await this.driver.pause(ms)
  }
}
