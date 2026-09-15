/**
 * REG_SRG_006 — Validate that a focal point national ID which is not exactly 14 digits is refused
 *
 * Feature: registry-self-registration   Route: :8445 /onboarding
 *
 * The Egyptian national ID is fourteen digits and its length is structural, not arbitrary: the
 * digits encode century, birth date, governorate of birth, sequence and a check digit. A 13- or
 * 15-digit value is not a typo the registry can tolerate — it cannot be decoded at all, so the
 * accountable human recorded against the company becomes unidentifiable.
 *
 * It satisfies every earlier rule first — GLN, GCP, governorate, district, names, e-mail, phone —
 * because the handler stops at the first failure. Without that setup this case would report a
 * district complaint and claim to have tested the national ID. The placeholder values used for
 * that setup are `QA_FOCAL_POINT`, which are deliberately self-identifying and never transmitted:
 * validation is client-side and the PUT is reached only once ALL rules pass, so a case that fails
 * one by construction sends nothing.
 *
 * WHAT IS NOT ASSERTED: the check digit, or that the encoded birth date is real. The platform's
 * rule is `/^\d{14}$/` — fourteen digits — and asserting more would fail against the behaviour as
 * specified. The length rule is what exists, so the length rule is what is tested.
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

const BAD_IDS = [
  { value: '2900101123456', why: '13 digits — one short' },
  { value: '2900101', why: '7 digits — far too short' },
  { value: '2900101123456A', why: '14 characters but not all digits' },
]

test('REG_SRG_006 — Validate that a focal point national ID which is not exactly 14 digits is refused', async ({
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

  // Satisfy every rule the handler checks BEFORE the national ID, so the refusal can only be
  // about the national ID.
  await fillCompanyData(page, { gln: '6220001716418', gcp: '6221042', governorate: 'cairo' })
  const district = await firstDistrictValue(page)
  expect(district, 'the Cairo governorate should offer at least one district').not.toBeNull()
  await fillCompanyData(page, {
    district: district as string,
    focalPointNameEn: QA_FOCAL_POINT.focalPointNameEn,
    focalPointNameAr: QA_FOCAL_POINT.focalPointNameAr,
    focalPointEmail: QA_FOCAL_POINT.focalPointEmail,
    focalPointPhone: QA_FOCAL_POINT.focalPointPhone,
  })

  for (const { value, why } of BAD_IDS) {
    await fillCompanyData(page, { nationalId: value })
    const outcome = await submitCompanyData(page)

    expect(
      outcome.requestSent,
      `a national ID of "${value}" (${why}) must not be sent — it cannot be decoded, so the ` +
        `accountable person would be unidentifiable. PUT answered ${outcome.putStatus}.`,
    ).toBe(false)

    expect(
      outcome.toasts.join(' | '),
      `the refusal of "${value}" (${why}) should state that the national ID must be exactly 14 ` +
        `digits, and must NOT be the generic "This field is required" — the applicant has ` +
        `supplied a value, and being told it is missing would send them looking in the wrong ` +
        `place. Captured: ${outcome.toasts.join(' | ') || '(nothing)'}`,
    ).toMatch(/14 digits/i)
  }
})
