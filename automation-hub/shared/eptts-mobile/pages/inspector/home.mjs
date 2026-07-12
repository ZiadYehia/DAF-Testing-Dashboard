import { BasePage } from '../../base-page.mjs'
import { TIMEOUTS } from '../../config.mjs'

// Note: the old InspectorHomePage also had tapViewShipments()/tapTrace()
// methods returning ViewShipmentsPage/TracePage. Those page objects aren't
// part of this pilot port (only the 5 pilot specs' needs were ported), so
// those nav methods are dropped here — the tile-visibility/logout surface
// below is everything eptts-inspector-home's spec uses.
export class InspectorHomePage extends BasePage {
  // ── Locators (verified via live Appium page source 2026-07-09) ───────────────
  // All tile content-descs are on non-clickable Flutter children; tap propagates to parent
  #VIEW_SHIPMENTS_TILE = '~View Shipments'
  #TRACE_TILE = '~Trace'
  #DELETE_ACCOUNT_TILE = '~Delete Account'
  #LOGOUT_TILE = '~Logout'

  // Header: content-desc="Hello\nSystem Admin Entity" (multiline, non-clickable)

  // Logout dialog confirm: must use XPath — android.widget.Button with content-desc="Logout"
  // (tile uses android.view.View with same content-desc; Button is unambiguous)
  #LOGOUT_CONFIRM_BTN = '//android.widget.Button[@content-desc="Logout"]'
  #LOGOUT_CANCEL_BTN = '~Cancel' // dialog cancel button
  #LOGOUT_DIALOG_BODY = '~Are you sure you want to logout?' // dialog body — use to detect dialog

  constructor(driver) {
    super(driver)
  }

  async waitForLoaded() {
    await this.waitForElement(this.#VIEW_SHIPMENTS_TILE, TIMEOUTS.page)
    return this
  }

  // ── Logout ───────────────────────────────────────────────────────────────────

  async tapLogout() {
    await this.tap(this.#LOGOUT_TILE)
    return this
  }

  async confirmLogout() {
    const btn = await this.driver.$(this.#LOGOUT_CONFIRM_BTN)
    await btn.waitForDisplayed({ timeout: TIMEOUTS.element })
    await btn.click()
  }

  async cancelLogout() {
    await this.tap(this.#LOGOUT_CANCEL_BTN)
    return this
  }

  async logout() {
    await this.tapLogout()
    await this.confirmLogout()
  }

  // ── Validations ─────────────────────────────────────────────────────────────

  async isViewShipmentsTileVisible() {
    return this.isDisplayed(this.#VIEW_SHIPMENTS_TILE)
  }

  async isTraceTileVisible() {
    return this.isDisplayed(this.#TRACE_TILE)
  }

  async isDeleteAccountTileVisible() {
    return this.isDisplayed(this.#DELETE_ACCOUNT_TILE)
  }

  async isLogoutTileVisible() {
    return this.isDisplayed(this.#LOGOUT_TILE)
  }

  async isLogoutDialogVisible() {
    return this.isDisplayed(this.#LOGOUT_DIALOG_BODY)
  }

  async isLoaded() {
    return this.isViewShipmentsTileVisible()
  }
}
