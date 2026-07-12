import { BasePage } from '../../base-page.mjs'
import { TIMEOUTS } from '../../config.mjs'

export class PatientHomePage extends BasePage {
  // ── Locators (verified via live Appium page source 2026-07-09) ───────────────
  // Patient home: tile has content-desc on non-clickable child; tap propagates to clickable parent
  #VALIDATE_PACK_TILE = '~Validate Pack'
  #BACK_TILE = '~Back' // clickable android.view.View

  // Validate Pack scanner screen (sub-screen)
  static SCANNER_BACK_BTN = '~Back' // android.widget.Button with tooltip-text="Back"
  static SCAN_CIRCLE_LABEL = '~Tap to scan GTIN / SGTIN' // label only; circle itself has no content-desc

  constructor(driver) {
    super(driver)
  }

  async waitForLoaded() {
    await this.waitForElement(this.#VALIDATE_PACK_TILE, TIMEOUTS.page)
    return this
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  async tapValidatePack() {
    await this.tap(this.#VALIDATE_PACK_TILE)
    return this
  }

  async navigateBack() {
    await this.pressBack()
  }

  // ── Validations ─────────────────────────────────────────────────────────────

  async isValidatePackTileVisible() {
    return this.isDisplayed(this.#VALIDATE_PACK_TILE)
  }

  async isLoaded() {
    return this.isValidatePackTileVisible()
  }
}
