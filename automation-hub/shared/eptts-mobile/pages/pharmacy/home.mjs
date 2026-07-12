import { BasePage } from '../../base-page.mjs'
import { TIMEOUTS } from '../../config.mjs'

// Note: the old PharmacyHomePage also had tapReceiveInvoice()/tapDispense()/
// tapReturnPack()/tapBranchReturn()/tapMyReturns()/tapEpcisHistory() methods
// returning their respective sub-page objects. Those aren't part of this
// pilot port (only the 5 pilot specs' needs were ported), so those nav
// methods are dropped — the tile-visibility/logout surface below is
// everything eptts-pharmacy-home's spec uses.
export class PharmacyHomePage extends BasePage {
  // ── Locators (verified via live Appium page source 2026-07-09) ────────────────
  // All tiles: content-desc on non-clickable Flutter child; tap propagates to parent
  // Pharmacy header: content-desc="Hello\nPH Sydy Bishr esaaf 24" (multiline, non-clickable)
  #RECEIVE_INVOICE_TILE = '~Receive Invoice'
  #DISPENSE_TILE = '~Dispense'
  #RETURN_PACK_TILE = '~Return Pack'
  #BRANCH_RETURN_TILE = '~Branch Return'
  #MY_RETURNS_TILE = '~My Returns'
  #EPCIS_HISTORY_TILE = '~EPCIS History'
  #DELETE_ACCOUNT_TILE = '~Delete Account'
  #LOGOUT_TILE = '~Logout'

  // Logout dialog confirm button: android.widget.Button (unique — tile is android.view.View)
  #LOGOUT_CONFIRM_BTN = '//android.widget.Button[@content-desc="Logout"]'
  #LOGOUT_CANCEL_BTN = '~Cancel'
  #LOGOUT_DIALOG_BODY = '~Are you sure you want to logout?'

  constructor(driver) {
    super(driver)
  }

  async waitForLoaded() {
    await this.waitForElement(this.#RECEIVE_INVOICE_TILE, TIMEOUTS.page)
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

  async isReceiveInvoiceTileVisible() {
    return this.isDisplayed(this.#RECEIVE_INVOICE_TILE)
  }

  async isDispenseTileVisible() {
    return this.isDisplayed(this.#DISPENSE_TILE)
  }

  async isReturnPackTileVisible() {
    return this.isDisplayed(this.#RETURN_PACK_TILE)
  }

  async isBranchReturnTileVisible() {
    return this.isDisplayed(this.#BRANCH_RETURN_TILE)
  }

  async isMyReturnsTileVisible() {
    return this.isDisplayed(this.#MY_RETURNS_TILE)
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

  async isLogoutDialogVisible() {
    return this.isDisplayed(this.#LOGOUT_DIALOG_BODY)
  }

  async isLoaded() {
    return this.isReceiveInvoiceTileVisible()
  }
}
