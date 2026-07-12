// Ported from the old suite's tests/login.test.ts ("Login") — the 4 it()
// blocks become sequential steps below.
import { runSpec } from '../../engine/appium/harness.mjs'
import { ROLES, getLandingPage, loginAs, LoginPage, ok } from '../../shared/eptts-mobile/index.mjs'

await runSpec(async (driver) => {
  console.log('should show the Keycloak form after tapping Sign In')
  const landing = await getLandingPage(driver)
  await landing.tapSignIn()
  // The old test probed `~username`/`~password` (accessibility ids) — the
  // Keycloak WebView fields only expose resource-ids, so use the page's
  // XPath-based probes instead (waitForFormReady also clears the keyboard
  // Chrome auto-opens, which otherwise hides the password field).
  const loginPage = await new LoginPage(driver).waitForFormReady()
  ok(await loginPage.isUsernameFieldVisible(), 'Username field not visible')
  ok(await loginPage.isPasswordFieldVisible(), 'Password field not visible')

  console.log('Inspector can log in and reach the home screen')
  let home = await loginAs(driver, ROLES.INSPECTOR)
  ok(await home.isLoaded(), 'Inspector home did not load')
  home = await loginAs(driver, ROLES.INSPECTOR)
  await home.logout()

  console.log('Pharmacy can log in and reach the home screen')
  home = await loginAs(driver, ROLES.PHARMACY)
  ok(await home.isLoaded(), 'Pharmacy home did not load')

  console.log('Distributor can log in and reach the home screen')
  home = await loginAs(driver, ROLES.DISTRIBUTOR)
  ok(await home.isLoaded(), 'Distributor home did not load')

  console.log('Branch can log in and reach the home screen')
  home = await loginAs(driver, ROLES.BRANCH)
  ok(await home.isLoaded(), 'Branch home did not load')
  home = await loginAs(driver, ROLES.BRANCH)
  await home.logout()
})
