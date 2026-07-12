// Ported from the old suite's tests/inspector/inspector-home.test.ts
// ("Inspector — Home") — the 3 it() blocks become sequential steps below.
import { runSpec } from '../../engine/appium/harness.mjs'
import { ROLES, loginAs, ok } from '../../shared/eptts-mobile/index.mjs'

await runSpec(async (driver) => {
  console.log('should display all 4 inspector tiles')
  let home = await loginAs(driver, ROLES.INSPECTOR)
  await home.verifyTileVisible('View Shipments')
  await home.verifyTileVisible('Trace')
  await home.verifyTileVisible('Delete Account')
  await home.verifyTileVisible('Logout')

  console.log('should show the logout dialog and cancel without logging out')
  home = await loginAs(driver, ROLES.INSPECTOR)
  await home.tapLogout()
  ok(await home.isLogoutDialogVisible(), 'Logout dialog did not appear')
  home = await loginAs(driver, ROLES.INSPECTOR)
  await home.tapLogout()
  await home.cancelLogout()
  ok(await home.isLoaded(), 'Inspector home did not reload after cancelling logout')

  console.log('should confirm logout and return to landing')
  home = await loginAs(driver, ROLES.INSPECTOR)
  await home.logout()
})
