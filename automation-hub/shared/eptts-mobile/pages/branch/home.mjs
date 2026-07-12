import { BasePage } from '../../base-page.mjs'
import { TIMEOUTS } from '../../config.mjs'

// Note: the old BranchHomePage also had tapCreateShipment()/tapMyShipments()/
// tapReceiveShipment()/tapReturns()/tapEpcisHistory() methods returning their
// respective sub-page objects. Those aren't part of this pilot port
// (login.test only checks isLoaded()/logout() for this role), so those nav
// methods are dropped — the tile-visibility/logout surface below is
// everything the pilot specs use.
export class BranchHomePage extends BasePage {
  // ── Locators ────────────────────────────────────────────────────────────────
  #CREATE_SHIPMENT_TILE = '~Create Shipment'
  #MY_SHIPMENTS_TILE = '~My Shipments'
  #RECEIVE_SHIPMENT_TILE = '~Receive Shipment'
  #RETURNS_TILE = '~Returns'
  #EPCIS_HISTORY_TILE = '~EPCIS History'
  #DELETE_ACCOUNT_TILE = '~Delete Account'
  #LOGOUT_TILE = '~Logout'

  // Logout dialog
  // Use XPath to target android.widget.Button — avoids matching the non-clickable Logout tile View
  #LOGOUT_CONFIRM_BTN = '//android.widget.Button[@content-desc="Logout"]'
  #LOGOUT_CANCEL_BTN = '~Cancel'

  constructor(driver) {
    super(driver)
  }

  async waitForLoaded() {
    await this.waitForElement(this.#CREATE_SHIPMENT_TILE, TIMEOUTS.page)
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

  async logout() {
    await this.tapLogout()
    await this.confirmLogout()
  }

  // ── Validations ─────────────────────────────────────────────────────────────

  async isCreateShipmentTileVisible() {
    return this.isDisplayed(this.#CREATE_SHIPMENT_TILE)
  }

  async isMyShipmentsTileVisible() {
    return this.isDisplayed(this.#MY_SHIPMENTS_TILE)
  }

  async isReceiveShipmentTileVisible() {
    return this.isDisplayed(this.#RECEIVE_SHIPMENT_TILE)
  }

  async isReturnsTileVisible() {
    return this.isDisplayed(this.#RETURNS_TILE)
  }

  async isEpcisHistoryTileVisible() {
    return this.isDisplayed(this.#EPCIS_HISTORY_TILE)
  }

  async isDeleteAccountTileVisible() {
    return this.isDisplayed(this.#DELETE_ACCOUNT_TILE)
  }

  async isLogoutTileVisible() {
    return this.isDisplayed(this.#LOGOUT_TILE)
  }

  async isLoaded() {
    return this.isCreateShipmentTileVisible()
  }
}
