import { BasePage } from '../base-page.mjs'
import { TIMEOUTS } from '../config.mjs'

export class LandingPage extends BasePage {
  // ── Locators ────────────────────────────────────────────────────────────────
  #SIGN_IN_BTN = '~Sign In'
  #PATIENT_BTN = '~Patient'

  constructor(driver) {
    super(driver)
  }

  async waitForLoaded() {
    await this.waitForElement(this.#SIGN_IN_BTN, TIMEOUTS.page)
    return this
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  async tapSignIn() {
    await this.tap(this.#SIGN_IN_BTN)
    // Chrome Custom Tab opens — caller is responsible for using LoginPage next
  }

  async tapPatient() {
    await this.tap(this.#PATIENT_BTN)
  }

  // ── Validations ─────────────────────────────────────────────────────────────

  async isSignInBtnVisible() {
    return this.isDisplayed(this.#SIGN_IN_BTN)
  }

  async isPatientBtnVisible() {
    return this.isDisplayed(this.#PATIENT_BTN)
  }

  async isLoaded() {
    return this.isSignInBtnVisible()
  }
}
