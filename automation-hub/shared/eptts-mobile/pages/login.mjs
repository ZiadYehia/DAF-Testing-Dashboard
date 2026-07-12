import { BasePage } from '../base-page.mjs'
import { TIMEOUTS } from '../config.mjs'
import { TokenManager } from '../token-manager.mjs'

/**
 * Handles the Keycloak login form rendered inside a Chrome Custom Tab.
 *
 * The form elements are Android WebView nodes exposed with @resource-id
 * attributes, so we locate them via XPath rather than accessibility id.
 *
 * Chrome dialogs handled here:
 *   1. FRE (First Run Experience) sign-in promo  → dismiss by resource-id button
 *   2. Account chooser bottom-sheet              → dismiss by tapping the scrim
 */
export class LoginPage extends BasePage {
  // ── Keycloak form locators (XPath — WebView native elements) ─────────────
  #USERNAME_FIELD = '//android.widget.EditText[@resource-id="username"]'
  #PASSWORD_FIELD = '//android.widget.EditText[@resource-id="password"]'
  #SIGN_IN_BTN = '//android.widget.Button[@resource-id="kc-login"]'

  // ── Chrome dialog locators ────────────────────────────────────────────────
  #CHROME_FRE_DISMISS = 'id:com.android.chrome:id/signin_fre_dismiss_button'

  constructor(driver) {
    super(driver)
  }

  async waitForLoaded() {
    // Chrome auto-focuses the username field; close the keyboard so the
    // whole form is laid out (and present in the a11y tree) before waiting.
    if (await this.driver.isKeyboardShown().catch(() => false)) {
      await this.driver.hideKeyboard().catch(() => {})
      await this.pause(300)
    }
    await this.waitForElement(this.#USERNAME_FIELD, TIMEOUTS.login)
    return this
  }

  /** Waits until both form fields are actually visible, revealing them if the keyboard hides them. */
  async waitForFormReady() {
    await this.waitForLoaded()
    await this.#reveal(this.#USERNAME_FIELD)
    await this.#reveal(this.#PASSWORD_FIELD)
    return this
  }

  // ── Chrome dialog handling ────────────────────────────────────────────────

  /** Dismisses the Chrome First Run Experience sign-in promo if it appears. */
  async dismissChromeFre() {
    try {
      const btn = await this.driver.$(this.#CHROME_FRE_DISMISS)
      await btn.waitForExist({ timeout: 5_000 })
      if (await btn.isDisplayed()) await btn.click()
    } catch {
      // Dialog not present — safe to continue
    }
  }

  /**
   * Dismisses the Chrome account chooser by tapping the translucent scrim
   * at the top of the screen (above the bottom sheet).
   */
  async dismissChromeAccountChooser() {
    try {
      const chooser = await this.driver.$(
        '//android.widget.FrameLayout[@resource-id="com.android.chrome:id/account_picker_bottom_sheet"]',
      )
      await chooser.waitForExist({ timeout: 4_000 })
      if (await chooser.isDisplayed()) {
        // Tap outside the bottom sheet (top 20% of screen)
        const { height, width } = await this.driver.getWindowSize()
        await this.driver
          .action('pointer', { parameters: { pointerType: 'touch' } })
          .move({ duration: 0, x: Math.floor(width / 2), y: Math.floor(height * 0.1) })
          .down({ button: 0 })
          .up({ button: 0 })
          .perform()
        await this.pause(1_000)
      }
    } catch {
      // Chooser not present — continue
    }
  }

  // ── Login action ──────────────────────────────────────────────────────────

  /**
   * Fills the Keycloak username/password form and submits.
   * Handles Chrome FRE and account chooser before interacting with the form.
   */
  /**
   * True when Chrome has handed control back to the app without a form —
   * Keycloak recognised its SSO cookie and redirected straight through.
   */
  async #autoSkipped() {
    const pkg = await this.driver.getCurrentPackage().catch(() => null)
    if (pkg !== 'com.daf.eda.eptts') return false
    // Back in the app: if the landing Sign In button is gone we're past login.
    return !(await this.isDisplayed('~Sign In').catch(() => false))
  }

  /**
   * Returns the element for `selector`, revealing it first if the on-screen
   * keyboard pushed it below the WebView viewport (zero-height, not
   * displayed): hide the keyboard, then scroll down as a last resort.
   */
  async #reveal(selector) {
    const el = this.driver.$(selector)
    if (await el.isDisplayed().catch(() => false)) return el
    // hideKeyboard() is a silent no-op on some Samsung/Chrome combos —
    // fall back to BACK, which only closes the keyboard while it is shown.
    if (await this.driver.isKeyboardShown().catch(() => false)) {
      await this.driver.hideKeyboard().catch(() => {})
      await this.pause(500)
      if (await this.driver.isKeyboardShown().catch(() => false)) {
        await this.driver.pressKeyCode(4).catch(() => {})
        await this.pause(500)
      }
    }
    // Scroll the form with a swipe confined to the upper part of the screen —
    // a gesture that reaches into the keyboard region gets swallowed by it.
    for (let i = 0; i < 3; i++) {
      if (await el.isDisplayed().catch(() => false)) return el
      const { width, height } = await this.driver.getWindowSize()
      await this.driver
        .execute('mobile: swipeGesture', {
          left: Math.floor(width * 0.3),
          top: Math.floor(height * 0.2),
          width: Math.floor(width * 0.4),
          height: Math.floor(height * 0.3),
          direction: 'up',
          percent: 0.9,
        })
        .catch(() => {})
      await this.pause(600)
    }
    await el.waitForDisplayed({ timeout: TIMEOUTS.element })
    return el
  }

  async login(email, password) {
    // Give Chrome Custom Tab time to render
    await this.pause(3_000)

    // Handle Chrome dialogs
    await this.dismissChromeFre()
    await this.dismissChromeAccountChooser()

    // Wait for the Keycloak form — or the SSO auto-skip redirect back to
    // the app, whichever happens first.
    let state = null
    await this.driver.waitUntil(
      async () => {
        // Chrome auto-focuses the username field, and with the keyboard up
        // its a11y tree can omit the form fields entirely — close it first.
        if (await this.driver.isKeyboardShown().catch(() => false)) {
          await this.driver.hideKeyboard().catch(() => {})
          await this.pause(300)
          if (await this.driver.isKeyboardShown().catch(() => false)) {
            await this.driver.pressKeyCode(4).catch(() => {})
            await this.pause(300)
          }
        }
        if (await this.isDisplayed(this.#USERNAME_FIELD).catch(() => false)) {
          state = 'form'
          return true
        }
        if (await this.#autoSkipped()) {
          state = 'skipped'
          return true
        }
        return false
      },
      { timeout: TIMEOUTS.login, interval: 1_000, timeoutMsg: 'Neither Keycloak form nor SSO auto-skip detected' },
    )
    if (state === 'skipped') {
      console.log('[LoginPage] SSO auto-skip — Keycloak form not shown')
      return
    }

    try {
      // Fill username
      const usernameEl = await this.#reveal(this.#USERNAME_FIELD)
      await usernameEl.clearValue()
      await usernameEl.setValue(email)

      // Fill password — typing the username raises the keyboard, which can
      // shrink the viewport and hide the password field entirely.
      const passwordEl = await this.#reveal(this.#PASSWORD_FIELD)
      await passwordEl.clearValue()
      await passwordEl.setValue(password)

      // Submit
      const signInBtn = await this.#reveal(this.#SIGN_IN_BTN)
      await signInBtn.click()
    } catch (err) {
      // The SSO redirect can close the tab mid-fill — treat that as success.
      if (await this.#autoSkipped()) {
        console.log('[LoginPage] SSO auto-skip mid-form — continuing')
        return
      }
      throw err
    }
  }

  /**
   * Smart login: uses TokenManager to cache the Keycloak session via REST
   * before doing the browser login. On repeated runs the REST call uses the
   * cached refresh_token (no username/password → no rate-limit hit). The
   * browser form is skipped when Keycloak recognises its own SSO session
   * cookie already stored in Chrome from a previous run (noReset=true).
   */
  async loginWithTokenCache(role, email, password) {
    try {
      await TokenManager.getAccessToken(role)
      console.log(`[LoginPage] Token warm for role=${role} — browser form may auto-skip`)
    } catch (err) {
      console.warn(`[LoginPage] Token cache miss (${err}) — will use browser form`)
    }
    await this.login(email, password)
  }

  // ── Validations ──────────────────────────────────────────────────────────

  async isUsernameFieldVisible() {
    return this.isDisplayed(this.#USERNAME_FIELD)
  }

  async isPasswordFieldVisible() {
    return this.isDisplayed(this.#PASSWORD_FIELD)
  }

  async isSignInBtnVisible() {
    return this.isDisplayed(this.#SIGN_IN_BTN)
  }
}
