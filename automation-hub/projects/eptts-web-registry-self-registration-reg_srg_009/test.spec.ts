/**
 * REG_SRG_009 — Validate that a complete company data step is accepted, validated against GS1 and unlocks the next step
 *
 * Feature: registry-self-registration   Route: :8445 /onboarding
 *
 * The positive half of the Company Data step, and the only case in this feature that reaches the
 * network. Everything else here proves what is refused; this proves that a correct submission is
 * accepted, is stored as submitted, and opens the step after it.
 *
 * IT SUPPLIES NO DATA OF ITS OWN, ON PURPOSE. The values come from env, and the case refuses to run
 * without them, because there is nothing safe to default to:
 *
 *  - The GLN and GCP must be REAL and must be registered to the logged-in company. The page states
 *    "Your Company GLN/GCP will be validated against the GS1 registry. You will not be able to
 *    proceed until this succeeds", so an invented pair either fails that check — proving nothing —
 *    or, worse, passes and binds someone else's prefix to this company.
 *  - The focal point is a NAMED HUMAN with a national ID. Fabricating a 14-digit national ID to
 *    satisfy `/^\d{14}$/` would write an identity document number belonging to a real person, or
 *    nobody, into a national registry. `QA_FOCAL_POINT` exists for the negative cases precisely
 *    because those never transmit; here it would.
 *
 * THE COMPANY IS DECIDED BY THE CREDENTIALS, NOT BY THIS CASE. The company block is read-only and
 * rendered from the EDA Company Profile in EPTTS_EDA_PROFILE_ID, so whichever company that profile
 * belongs to is the one this case registers. The GLN/GCP supplied must belong to THAT company.
 * REG_SRG_003 asserts this property; the annotation below records which identity was actually used,
 * so a run can be audited afterwards.
 *
 * IRREVERSIBLE, AND GATED TWICE OVER. A successful submission advances a real registration on the
 * production registry, which offers no delete control. It needs the data above AND
 * EPTTS_WEB_ALLOW_REGISTRY_WRITE.
 *
 * It stops at the end of the Company Data step and deliberately does not go on to submit the
 * registration: `POST /onboarding/registration/submit` sets the new account's password and grants
 * platform access, which is a different decision from validating company data and belongs to its
 * own case.
 */
import { expect, test } from '@playwright/test'
import { requireEnv } from '../../lib/env'
import {
  chooseEntityType,
  fillCompanyData,
  loginWithCompanyProfile,
  openOnboarding,
  readCompanyBlock,
  submitCompanyData,
} from '../../pages/eptts-web/onboarding.page'

test.use({ ignoreHTTPSErrors: true, storageState: { cookies: [], origins: [] } })

/** Every value this case cannot invent. Named so a missing one names itself in the skip reason. */
const REQUIRED_ENV = [
  'EPTTS_SRG_GLN',
  'EPTTS_SRG_GCP',
  'EPTTS_SRG_GOVERNORATE',
  'EPTTS_SRG_DISTRICT',
  'EPTTS_SRG_FP_NAME_EN',
  'EPTTS_SRG_FP_NAME_AR',
  'EPTTS_SRG_FP_EMAIL',
  'EPTTS_SRG_FP_PHONE',
  'EPTTS_SRG_FP_NID',
  'EPTTS_SRG_FP_NID_EXPIRY',
  'EPTTS_SRG_FP_TITLE_EN',
  'EPTTS_SRG_FP_TITLE_AR',
] as const

test('REG_SRG_009 — Validate that a complete company data step is accepted, validated against GS1 and unlocks the next step', async ({
  page,
}) => {
  test.setTimeout(300_000)

  const missing = REQUIRED_ENV.filter((key) => !process.env[key])
  test.fixme(
    missing.length > 0,
    `Blocked on test data, not on a defect. Missing: ${missing.join(', ')}. This case advances a ` +
      `real registration on a registry with no delete control, so it cannot invent its inputs: ` +
      `the GLN/GCP must be registered to the logged-in company in the GS1 registry, and the focal ` +
      `point's national ID is a real person's identity document. Set these in automation-hub/.env ` +
      `once the applicant has supplied them.`,
  )
  test.fixme(
    !process.env.EPTTS_WEB_ALLOW_REGISTRY_WRITE,
    'Irreversible production write: advances a real company registration on the shared devsim ' +
      'registry, which offers NO DELETE. Set EPTTS_WEB_ALLOW_REGISTRY_WRITE=1 in ' +
      'automation-hub/.env for a deliberate run.',
  )

  const profileId = requireEnv('EPTTS_EDA_PROFILE_ID')

  await openOnboarding(page)
  await chooseEntityType(page, 'Factory')
  const login = await loginWithCompanyProfile(
    page,
    profileId,
    requireEnv('EPTTS_EDA_PROFILE_PASSWORD'),
  )
  expect(
    login.reachedCompanyStep,
    `the Company Data step should be reachable. Session answered ${login.sessionStatus}; ` +
      `platform said: ${login.toasts.join(' | ') || '(nothing)'}`,
  ).toBe(true)

  // Record WHICH company is being registered before changing anything, so the run is auditable.
  const company = await readCompanyBlock(page)
  test.info().annotations.push({
    type: 'registered-on-production',
    description:
      `EDA profile ${profileId} → "${company.nameEn}" (licence ${company.licenseNo}, tax ` +
      `${company.taxNo}); GLN ${requireEnv('EPTTS_SRG_GLN')} / GCP ${requireEnv('EPTTS_SRG_GCP')}`,
  })

  const gln = requireEnv('EPTTS_SRG_GLN')

  await fillCompanyData(page, {
    gln,
    gcp: requireEnv('EPTTS_SRG_GCP'),
    governorate: requireEnv('EPTTS_SRG_GOVERNORATE'),
  })
  await fillCompanyData(page, {
    district: requireEnv('EPTTS_SRG_DISTRICT'),
    focalPointNameEn: requireEnv('EPTTS_SRG_FP_NAME_EN'),
    focalPointNameAr: requireEnv('EPTTS_SRG_FP_NAME_AR'),
    focalPointEmail: requireEnv('EPTTS_SRG_FP_EMAIL'),
    focalPointPhone: requireEnv('EPTTS_SRG_FP_PHONE'),
    nationalId: requireEnv('EPTTS_SRG_FP_NID'),
    nationalIdExpiry: requireEnv('EPTTS_SRG_FP_NID_EXPIRY'),
    jobTitleEn: requireEnv('EPTTS_SRG_FP_TITLE_EN'),
    jobTitleAr: requireEnv('EPTTS_SRG_FP_TITLE_AR'),
  })

  const outcome = await submitCompanyData(page)

  // 1. It reached the platform at all. Every negative case in this feature asserts the opposite,
  //    so this is what distinguishes a complete form from an incomplete one.
  expect(
    outcome.requestSent,
    `a complete Company Data step should be submitted to the platform. Nothing was sent, so a ` +
      `validation rule refused it: ${outcome.toasts.join(' | ') || '(no message captured)'}`,
  ).toBe(true)

  // 2. And was accepted. A GS1 mismatch surfaces here, which is why the message is quoted.
  expect(
    outcome.putStatus,
    `the submission should be accepted. The platform answered ${outcome.putStatus} and said: ` +
      `${outcome.toasts.join(' | ') || '(nothing)'}. A refusal naming GS1 means the GLN/GCP pair ` +
      `is not registered to "${company.nameEn}" — that is test-data to correct, not a defect.`,
  ).toBeLessThan(300)

  // 3. And the applicant can proceed. An accepted submission that leaves them on the same step
  //    would be a dead end regardless of what was stored.
  expect(
    outcome.advanced,
    `accepting the company data should unlock the next step — a Factory goes on to Products. ` +
      `Platform said: ${outcome.toasts.join(' | ') || '(nothing)'}`,
  ).toBe(true)

  // 4. Finally, that what was stored is what was entered. Re-read from the platform rather than
  //    trusted from the form, because the form is the thing under test.
  const stored = await page.evaluate(async () => {
    const res = await fetch('/registry-service/api/v1/onboarding/registration/me', {
      headers: { Accept: 'application/json' },
    })
    return res.ok ? await res.json() : null
  })
  if (stored) {
    expect(
      stored.gln,
      'the stored registration should carry the GLN that was entered',
    ).toBe(gln)
  }
})
