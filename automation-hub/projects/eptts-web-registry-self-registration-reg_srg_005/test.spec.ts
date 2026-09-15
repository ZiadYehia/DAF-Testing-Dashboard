/**
 * REG_SRG_005 — Validate that a company GCP outside 4 to 12 digits is refused
 *
 * Feature: registry-self-registration   Route: :8445 /onboarding
 *
 * The GCP is the company prefix every one of that company's GTINs and SSCCs is minted from, and
 * its LENGTH is not decoration: it is what tells a reader where the prefix ends and the item
 * reference begins. A wrong GCP length does not produce an obviously broken barcode — it produces
 * one that parses into the wrong company and the wrong item, silently, for the life of the record.
 * That is why the rule is a range rather than a fixed size, and why both ends of it are tested.
 *
 * IT SATISFIES THE GLN RULE FIRST, DELIBERATELY. Validation stops at the first failure, so leaving
 * the GLN blank would produce a GLN complaint and prove nothing about the GCP. The GLN used is a
 * real, check-digit-valid one so that the only rule under test is the GCP's.
 *
 * As with the GLN, the over-length case is prevented at entry (`maxlength=12`) rather than refused
 * at validation, so it is asserted on what the field can hold rather than on a message.
 *
 * Writes nothing: every attempt asserts the platform was never called.
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

const VALID_GLN = '6220001716418'

const BAD_GCPS = [
  { value: '622', why: '3 digits — below the 4 digit minimum' },
  { value: '62210A2', why: 'contains a letter' },
  { value: '', why: 'empty — the GCP is mandatory, not optional' },
]

test('REG_SRG_005 — Validate that a company GCP outside 4 to 12 digits is refused', async ({
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

  for (const { value, why } of BAD_GCPS) {
    await fillCompanyData(page, { gln: VALID_GLN, gcp: value })
    const outcome = await submitCompanyData(page)

    expect(
      outcome.requestSent,
      `a GCP of "${value}" (${why}) must not be sent to the platform — every GTIN and SSCC this ` +
        `company mints is parsed against its prefix length. PUT answered ${outcome.putStatus}.`,
    ).toBe(false)

    expect(
      outcome.toasts.join(' | '),
      `the refusal of "${value}" (${why}) should state that the GCP is required and must be 4 to ` +
        `12 digits, so the applicant knows the permitted range rather than guessing. ` +
        `Captured: ${outcome.toasts.join(' | ') || '(nothing)'}`,
    ).toMatch(/GCP/i)
  }

  await fillCompanyData(page, { gcp: '6221042999999999' })
  expect(
    await page.locator('#tnt-gcp').inputValue(),
    'the GCP field should refuse to hold more than 12 characters, so an over-length prefix cannot ' +
      'be entered at all',
  ).toHaveLength(12)
})
