/**
 * REG_SRG_007 — Validate that a national ID expiry date not written as MM/YYYY is refused
 *
 * Feature: registry-self-registration   Route: :8445 /onboarding
 *
 * A free-text date field with no picker is where ambiguity gets into a registry. The rule here is
 * `/^(0[1-9]|1[0-2])\/\d{4}$/` — a zero-padded two-digit month, a slash, four digits — and each
 * case below breaks it in a way a real applicant plausibly would.
 *
 * THE SINGLE-DIGIT MONTH IS THE INTERESTING ONE. "6/2030" is what most people type, and it is
 * unambiguous to a human, so it is the case most likely to have been overlooked or "helpfully"
 * accepted. The regex demands the padding, so this asserts the refusal — if the platform ever
 * chooses to normalise single-digit months instead, this case is where that decision surfaces for
 * review rather than slipping in unnoticed.
 *
 * "2030-06" covers the other half of the ambiguity: an ISO-shaped value, which a system that
 * accepted both would have to guess about. And "13/2030" is a month that does not exist, which a
 * pure "digits and a slash" check would let through.
 *
 * Every earlier rule is satisfied first, including a well-formed 14-digit national ID, so the only
 * thing that can be refused is the expiry. Placeholder identity values are `QA_FOCAL_POINT` and
 * never leave the browser — the PUT is reached only when all rules pass.
 */
import { expect, test } from '@playwright/test'
import { requireEnv } from '../../lib/env'
import {
  chooseEntityType,
  fillCompanyData,
  firstDistrictValue,
  loginWithCompanyProfile,
  openOnboarding,
  QA_FOCAL_POINT,
  submitCompanyData,
} from '../../pages/eptts-web/onboarding.page'

test.use({ ignoreHTTPSErrors: true, storageState: { cookies: [], origins: [] } })

const BAD_EXPIRIES = [
  { value: '13/2030', why: 'month 13 does not exist' },
  { value: '2030-06', why: 'ISO-shaped rather than MM/YYYY — ambiguous if both were accepted' },
  { value: '6/2030', why: 'single-digit month; the format requires zero padding' },
  { value: '00/2030', why: 'month 00 does not exist' },
]

test('REG_SRG_007 — Validate that a national ID expiry date not written as MM/YYYY is refused', async ({
  page,
}) => {
  test.setTimeout(240_000)

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

  await fillCompanyData(page, { gln: '6220001716418', gcp: '6221042', governorate: 'cairo' })
  const district = await firstDistrictValue(page)
  expect(district, 'the Cairo governorate should offer at least one district').not.toBeNull()
  await fillCompanyData(page, {
    district: district as string,
    focalPointNameEn: QA_FOCAL_POINT.focalPointNameEn,
    focalPointNameAr: QA_FOCAL_POINT.focalPointNameAr,
    focalPointEmail: QA_FOCAL_POINT.focalPointEmail,
    focalPointPhone: QA_FOCAL_POINT.focalPointPhone,
    // Well-formed, so the national ID rule cannot be what refuses these attempts.
    nationalId: '29001011234567',
  })

  for (const { value, why } of BAD_EXPIRIES) {
    await fillCompanyData(page, { nationalIdExpiry: value })
    const outcome = await submitCompanyData(page)

    expect(
      outcome.requestSent,
      `an expiry of "${value}" (${why}) must not be sent to the platform. PUT answered ` +
        `${outcome.putStatus}.`,
    ).toBe(false)

    expect(
      outcome.toasts.join(' | '),
      `the refusal of "${value}" (${why}) should state the MM/YYYY format, so the applicant can ` +
        `correct it without guessing. Captured: ${outcome.toasts.join(' | ') || '(nothing)'}`,
    ).toMatch(/MM\/YYYY/i)
  }
})
