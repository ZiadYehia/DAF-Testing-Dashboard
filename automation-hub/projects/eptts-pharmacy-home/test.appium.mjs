// Ported from the old suite's tests/pharmacy/pharmacy-home.test.ts
// ("Pharmacy — Home").
import { runSpec } from '../../engine/appium/harness.mjs'
import { ROLES, loginAs } from '../../shared/eptts-mobile/index.mjs'

await runSpec(async (driver) => {
  console.log('should display all 6 pharmacy tiles')
  const home = await loginAs(driver, ROLES.PHARMACY)
  await home.verifyTileVisible('Receive Invoice')
  await home.verifyTileVisible('Dispense')
  await home.verifyTileVisible('Return Pack')
  await home.verifyTileVisible('Branch Return')
  await home.verifyTileVisible('My Returns')
  await home.verifyTileVisible('EPCIS History')
})
