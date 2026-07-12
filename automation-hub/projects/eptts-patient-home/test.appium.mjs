// Ported from the old suite's tests/patient/patient.test.ts ("Patient — Home")
// — the 2 it() blocks become sequential steps below.
import { runSpec } from '../../engine/appium/harness.mjs'
import { ROLES, loginAs, ok } from '../../shared/eptts-mobile/index.mjs'

await runSpec(async (driver) => {
  console.log('should display the Validate Pack tile')
  let home = await loginAs(driver, ROLES.PATIENT)
  await home.verifyTileVisible('Validate Pack')

  console.log('should open the scanner and return on back press')
  home = await loginAs(driver, ROLES.PATIENT)
  home = await home.tapValidatePack()
  await home.pressBack()
  home = await loginAs(driver, ROLES.PATIENT)
  ok(await home.isLoaded(), 'Patient home did not reload after back press')
})
