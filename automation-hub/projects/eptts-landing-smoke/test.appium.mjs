// Ported from the old suite's tests/landing.test.ts ("Landing Screen").
import { runSpec } from '../../engine/appium/harness.mjs'
import { getLandingPage } from '../../shared/eptts-mobile/index.mjs'

await runSpec(async (driver) => {
  console.log('should display both entry-point buttons')
  const landing = await getLandingPage(driver)
  await landing.verifyTileVisible('Sign In')
  await landing.verifyTileVisible('Patient')
})
