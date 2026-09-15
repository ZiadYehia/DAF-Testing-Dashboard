/**
 * REG_SRG_004 — Validate that a company GLN which is not exactly 13 digits is refused
 *
 * Feature: registry-self-registration   Route: :8445 /onboarding
 *
 * The GLN is the company's identity everywhere downstream — it is what shipments are addressed to,
 * what invoices are raised against, and what the billing gate holds. A malformed one accepted at
 * registration is not a form problem; it is a corrupt party record in a registry with no delete
 * control, and every event that later references it inherits the error.
 *
 * THREE SHAPES, EACH A DIFFERENT WAY TO BE WRONG: too short, too long, and right-length but not
 * numeric. A rule implemented as a length check alone passes the third; one implemented as a
 * numeric parse alone passes the first two. Testing only one shape cannot tell those apart.
 *
 * NOTE WHAT IS NOT ASSERTED HERE: the check digit. The platform's rule is `/^\d{13}$/` — thirteen
 * digits, nothing more — so a GLN whose check digit is wrong is accepted at this step and left to
 * the GS1 registry validation the page warns about. That is a legitimate division of labour and
 * this case does not pretend otherwise; asserting a check-digit refusal here would fail against
 * correct behaviour.
 *
 * WRITES NOTHING, and that is proven rather than assumed: every attempt asserts `requestSent` is
 * false, because validation is client-side and the PUT is only reached once all rules pass.
 */
import { expect, test } from '@playwright/test'
import { requireEnv } from '../../lib/env'
import {
  chooseEntityType,
  fillCompanyData,
  loginWithCompanyProfile,
  openOnboarding,
  submitCompanyData,
} from '../../pages/eptts-web/onboarding.page'

test.use({ ignoreHTTPSErrors: true, storageState: { cookies: [], origins: [] } })

/**
 * Each is a distinct way for a GLN to be malformed AND to be reachable through the form.
 *
 * An over-length GLN is deliberately not in this list: `#tnt-gln` carries `maxlength=13`, so a
 * 14-digit value cannot be typed at all — it truncates to 13 digits, which for "62200017164188"
 * yields the perfectly valid "6220001716418" and validation moves on to the next rule. Asserting a
 * length complaint for it therefore fails against CORRECT behaviour: the platform prevents the
 * input rather than rejecting it afterwards. That prevention is asserted separately below, which is
 * the honest way to cover it.
 */
const BAD_GLNS = [
  { value: '622000171641', why: '12 digits — one short' },
  { value: '62200017164A8', why: '13 characters but not all digits' },
]

test('REG_SRG_004 — Validate that a company GLN which is not exactly 13 digits is refused', async ({
  page,
}) => {
  test.setTimeout(180_000)

  await openOnboarding(page)
  await chooseEntityType(page, 'Factory')
  const login = await loginWithCompanyProfile(
    page,
    requireEnv('EPTTS_EDA_PROFILE_ID'),
    requireEnv('EPTTS_EDA_PROFILE_PASSWORD'),
  )
  expect(
    login.reachedCompanyStep,
    `the Company Data step should be reachable. Session answered ${login.sessionStatus}; ` +
      `platform said: ${login.toasts.join(' | ') || '(nothing)'}`,
  ).toBe(true)

  for (const { value, why } of BAD_GLNS) {
    await fillCompanyData(page, { gln: value, gcp: '6221042' })
    const outcome = await submitCompanyData(page)

    expect(
      outcome.requestSent,
      `a GLN of "${value}" (${why}) must not be sent to the platform. The company data was ` +
        `submitted anyway (PUT answered ${outcome.putStatus}), which means a malformed GLN ` +
        `reached the registry.`,
    ).toBe(false)

    expect(
      outcome.advanced,
      `the flow must stay on the Company Data step while the GLN is "${value}" (${why})`,
    ).toBe(false)

    expect(
      outcome.toasts.join(' | '),
      `the refusal of "${value}" (${why}) should tell the applicant the GLN must be exactly 13 ` +
        `digits. Silence here is indistinguishable from a broken button — the message is a ` +
        `transient toast, so it is captured by observer rather than read off the screen. ` +
        `Captured: ${outcome.toasts.join(' | ') || '(nothing)'}`,
    ).toMatch(/13 digits/i)
  }

  // Over-length is prevented at entry rather than refused at validation. Asserted on what the
  // field actually holds after typing 14 digits, because that is the mechanism: maxlength=13.
  await fillCompanyData(page, { gln: '62200017164188' })
  expect(
    await page.locator('#tnt-gln').inputValue(),
    'the GLN field should refuse to hold more than 13 characters, so an over-length GLN cannot be ' +
      'entered in the first place',
  ).toHaveLength(13)
})
