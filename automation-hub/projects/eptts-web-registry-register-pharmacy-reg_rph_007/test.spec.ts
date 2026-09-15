/**
 * REG_RPH_007 — Validate that a pharmacy is registered with a login account and an activation key, and that its credentials are shown once
 *
 * Feature: registry-register-pharmacy   Portal: https://192.168.225.195:8445 → "➕ Register Pharmacy"
 *
 * Checks the onboarding step that creates a trading identity: a pharmacy is registered, a login
 * account is minted for it, and an agent activation key is issued — in one submission.
 *
 * THE CREDENTIALS ARE SHOWN ONCE, WHICH IS THE WHOLE REASON THIS CASE CAPTURES THEM. A generated
 * password that is not read off the confirmation cannot be recovered — admin password reset on
 * this service returns 503 — so anything not captured here is gone. They are recorded as an
 * annotation rather than asserted against fixed values: a generated secret has no expected value,
 * only expected presence.
 *
 * KNOWN TO FAIL, AGAINST TWO FILED BUGS, AND DELIBERATELY NOT RELAXED. The registration itself
 * succeeds — the party and its account are both created — but the page shows NO confirmation at
 * all, so the generated password is never revealed
 * (draft:pharmacy-registration-shows-no-confirmation-so-the-generated-password-is-lost), and the
 * activation key 404s
 * (draft:agent-activation-key-generation-returns-404-during-pharmacy-registration). Asserting the
 * observed silence instead would make the defect indistinguishable from correct behaviour.
 *
 * WRITES TO PRODUCTION, IRREVERSIBLY, AND THERE IS NO DELETE. The registry offers no way to
 * remove a party. This case therefore:
 *   - is gated behind EPTTS_WEB_ALLOW_REGISTRY_WRITE, absent from .env by default;
 *   - mints a GLN from a reserved 88888 block with a correct GS1 check digit, self-checked before
 *     submission — a malformed GLN persisted here would key custody records that can never be
 *     reconciled, which is the worst outcome available in this suite;
 *   - names the pharmacy `ZZ QA TEST PHARMACY <run>` so it sorts to the end of any list and reads
 *     unmistakably as test data to whoever finds it later;
 *   - writes what it created into the run annotations, because that inventory is the only durable
 *     record of rows nobody can delete.
 *
 * It runs as the INSPECTOR because that is the role the platform intends for onboarding: the page
 * states "Inspectors can onboard a new pharmacy here (a Dispenser party) … Backend enforces
 * ADMIN/INSPECTOR role". A bug filed against that entitlement was retracted — `eptts-mobile`
 * defines a read-only inspector, but that is a different surface with a different permission set.
 */
import { expect, test } from '@playwright/test'
import { uniqueSuffix } from '../../lib/framework/data'
import {
  fillPharmacyForm,
  glnCheckDigit,
  isValidGln,
  openRegistry,
  goToRegistryTab,
  submitPharmacyForm,
} from '../../pages/eptts-web/registry.page'
import { ensureRoleState } from '../../pages/eptts-web/roles'

test.use({ ignoreHTTPSErrors: true })

/**
 * Reserved 5-digit block for pharmacies this suite creates.
 *
 * Chosen to be obviously synthetic and not to collide with anything on the tenant: the real GLNs
 * seen here start 5413868, 6220003, 6225001, 6290000, 0085412. `99999` is deliberately avoided —
 * that is the platform's own GLN (9999999999999), which is not even a valid GS1 GLN.
 */
const BLOCK = '88888'

test('REG_RPH_007 — Validate that a pharmacy is registered with a login account and an activation key, and that its credentials are shown once', async ({
  browser,
}) => {
  test.slow()
  test.fixme(
    !process.env.EPTTS_WEB_ALLOW_REGISTRY_WRITE,
    'Irreversible production write: registers a real pharmacy on the shared devsim tenant and ' +
      'mints a login account for it. The registry offers NO DELETE, so this cannot be undone. ' +
      'Set EPTTS_WEB_ALLOW_REGISTRY_WRITE=1 in automation-hub/.env for a deliberate run.',
  )

  // A unique GLN with a correct check digit. uniqueSuffix() is 11 digits, so the block plus its
  // fast-changing tail fills the 12-digit payload and reruns cannot collide.
  const payload = (BLOCK + uniqueSuffix()).slice(0, 12)
  const gln = payload + glnCheckDigit(payload)

  // Self-check before anything is submitted. This is the guard that makes a wrong check-digit
  // implementation impossible to use silently — the same discipline the dashboard page object
  // applies in reverse when it asserts a deliberately-invalid GLN really is invalid.
  expect(
    isValidGln(gln),
    `${gln} must satisfy the GS1 mod-10 rule before it is registered. A malformed GLN persisted ` +
      `here would key SGTINs and custody records that can never be reconciled.`,
  ).toBe(true)

  const run = uniqueSuffix()
  const name = `ZZ QA TEST PHARMACY ${run}`
  const draft = {
    gln,
    prefix: BLOCK + run.slice(0, 3),
    name,
    // ASCII in the Arabic-labelled fields too: data/ is committed and its validator rejects
    // Arabic that leaks into documents, so a name copied out of a screenshot stays safe.
    nameAr: name,
    phone: '0200000000',
    address: `QA TEST DATA - automation-hub REG_RPH_007 - do not use - ${run}`,
    addressAr: `QA TEST DATA - automation-hub REG_RPH_007 - do not use - ${run}`,
    taxId: `QA${run}`,
    generateAccount: true,
    generateKey: true,
    userEmail: `zz-qa-pharmacy-${run}@example.invalid`,
  }

  const context = await browser.newContext({
    storageState: await ensureRoleState('inspector', 'eptts-registry'),
    ignoreHTTPSErrors: true,
  })

  try {
    const page = await context.newPage()
    await openRegistry(page)
    await goToRegistryTab(page, '➕ Register Pharmacy')
    await fillPharmacyForm(page, draft)

    const result = await submitPharmacyForm(page, draft)

    // Recorded BEFORE the assertions, so the identifiers survive a failure. These rows cannot be
    // deleted, and a key not written down here is unrecoverable.
    test.info().annotations.push({
      type: 'created-on-production',
      description:
        `pharmacy ${gln} "${name}" | username ${result.username ?? '(not captured)'} | ` +
        `password ${result.password ? '(captured, see run output)' : '(not captured)'} | ` +
        `activationKey ${result.apiKey ? '(captured, see run output)' : '(not captured)'}`,
    })
    // The key in full, once, to the run log only — never to data/, which is committed.
    if (result.apiKey) console.log(`[REG_RPH_007] activation key for ${gln}: ${result.apiKey}`)
    if (result.password) console.log(`[REG_RPH_007] password for ${result.username}: ${result.password}`)

    // 1. The registration was accepted and names what it created.
    expect(
      result.panel,
      `the confirmation should name the GLN that was registered. Panel read: ${result.panel}`,
    ).toContain(gln)

    // 2. A login account exists for it.
    expect(
      result.username,
      `a username should be shown for the new pharmacy — rp-gen-account was selected. ` +
        `Panel read: ${result.panel}`,
    ).toBeTruthy()

    // 3. And a generated password, because rp-user-pw was left blank and its own placeholder
    //    says "leave blank to auto-generate".
    expect(
      result.password,
      `a generated password should be shown, since rp-user-pw was left blank. Panel read: ` +
        `${result.panel}`,
    ).toBeTruthy()

    // 4. And the AGENT ACTIVATION KEY that was asked for. Not a B2B API key: rp-gen-key is
    //    labelled "Generate agent activation key (16-char, 30-day expiry)" and pairs the
    //    pharmacy's desktop agent. The 64-hex B2B key is a separate action on Parties.
    //
    //    KNOWN TO FAIL: POST /registry-service/api/v1/agent/activation-keys/generate answers 404,
    //    so no key is ever issued -
    //    draft:agent-activation-key-generation-returns-404-during-pharmacy-registration.
    expect(
      result.apiKey,
      `an agent activation key should be shown - rp-gen-key was selected. Panel read: ` +
        `${result.panel}`,
    ).toBeTruthy()
  } finally {
    await context.close()
  }
})
