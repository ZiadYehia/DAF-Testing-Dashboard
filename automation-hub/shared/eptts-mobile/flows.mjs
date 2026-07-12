/**
 * Functional port of the old suite's tests/BaseTest.ts. No jest lifecycle
 * here (setup()/teardown() managed the shared driver singleton) — the
 * harness owns the driver's lifecycle instead, so these are plain async
 * functions that take the driver as an argument.
 */
import { ROLES, CREDENTIALS } from './config.mjs'
import { LandingPage } from './pages/landing.mjs'
import { LoginPage } from './pages/login.mjs'
import { PatientHomePage } from './pages/patient/home.mjs'
import { InspectorHomePage } from './pages/inspector/home.mjs'
import { PharmacyHomePage } from './pages/pharmacy/home.mjs'
import { DistributorHomePage } from './pages/distributor/home.mjs'
import { BranchHomePage } from './pages/branch/home.mjs'

const SIGN_IN_BTN = '~Sign In'
const LOGOUT_TILE = '~Logout'
const LOGOUT_CONFIRM_BTN = '//android.widget.Button[@content-desc="Logout"]'

/**
 * With noReset the app keeps its previous state (logged-in role, nested
 * screen, Keycloak SSO cookie), so a run may start anywhere. Walk back to
 * a known state: back-press out of nested screens, log out if a home page
 * is reached, until the landing page's Sign In button appears.
 */
async function ensureLandingPage(driver) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const pkg = await driver.getCurrentPackage().catch(() => null)
    if (pkg === 'com.android.chrome') {
      // Leftover login Custom Tab — BACK destroys it and returns to the app.
      // (activateApp would leave the tab alive, and the next Sign In tap
      // resumes it with a stale, collapsed form.)
      await driver.back()
      await driver.pause(1500)
      continue
    }
    if (pkg && pkg !== 'com.daf.eda.eptts') {
      // A back-press from the app root minimizes the app — bring it back.
      await driver.activateApp('com.daf.eda.eptts')
      await driver.pause(2000)
    }
    if (await driver.$(SIGN_IN_BTN).isDisplayed().catch(() => false)) return
    const logoutTile = driver.$(LOGOUT_TILE)
    if (await logoutTile.isDisplayed().catch(() => false)) {
      await logoutTile.click()
      // Some builds confirm via dialog, others log out immediately.
      const confirm = driver.$(LOGOUT_CONFIRM_BTN)
      const confirmed = await confirm
        .waitForDisplayed({ timeout: 5_000 })
        .catch(() => false)
      if (confirmed !== false) await confirm.click().catch(() => {})
      await driver.pause(1500)
      continue
    }
    await driver.back()
    await driver.pause(1500)
  }
}

/** Returns the loaded LandingPage for `driver`, recovering from leftover app state. */
export async function getLandingPage(driver) {
  await ensureLandingPage(driver)
  return new LandingPage(driver).waitForLoaded()
}

/**
 * Logs in as `role` and returns the loaded home page for that role. Ports
 * BaseTest.loginAs: for PATIENT, taps the Patient entry point directly (no
 * Keycloak form); every other role goes through Sign In + LoginPage, warming
 * the SSO/token cache via TokenManager first (loginWithTokenCache).
 */
const LOGOUT_DIALOG_BODY = '~Are you sure you want to logout?'
const LOGOUT_CANCEL_BTN = '~Cancel'

function homePageFor(driver, role) {
  switch (role) {
    case ROLES.PATIENT: return new PatientHomePage(driver)
    case ROLES.INSPECTOR: return new InspectorHomePage(driver)
    case ROLES.DISTRIBUTOR: return new DistributorHomePage(driver)
    case ROLES.BRANCH: return new BranchHomePage(driver)
    case ROLES.PHARMACY:
    default: return new PharmacyHomePage(driver)
  }
}

export async function loginAs(driver, role) {
  // A stray logout dialog hides the page underneath — cancel it first.
  if (await driver.$(LOGOUT_DIALOG_BODY).isDisplayed().catch(() => false)) {
    await driver.$(LOGOUT_CANCEL_BTN).click().catch(() => {})
    await driver.pause(1000)
  }

  // Already on this role's home (noReset keeps the session)? Skip the
  // logout/login churn the landing recovery would otherwise do.
  const existing = homePageFor(driver, role)
  if (await existing.isLoaded().catch(() => false)) return existing

  const landing = await getLandingPage(driver)

  if (role === ROLES.PATIENT) {
    await landing.tapPatient()
    return new PatientHomePage(driver).waitForLoaded()
  }

  await landing.tapSignIn()

  const loginPage = new LoginPage(driver)
  const creds = CREDENTIALS[role]
  await loginPage.loginWithTokenCache(role, creds.email, creds.password)

  // Wait for the home screen based on role
  switch (role) {
    case ROLES.INSPECTOR:
      return new InspectorHomePage(driver).waitForLoaded()
    case ROLES.DISTRIBUTOR:
      return new DistributorHomePage(driver).waitForLoaded()
    case ROLES.BRANCH:
      return new BranchHomePage(driver).waitForLoaded()
    case ROLES.PHARMACY:
    default:
      return new PharmacyHomePage(driver).waitForLoaded()
  }
}
