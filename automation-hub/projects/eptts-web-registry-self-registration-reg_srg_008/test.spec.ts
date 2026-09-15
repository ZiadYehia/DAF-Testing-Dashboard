/**
 * REG_SRG_008 — Validate that the mandatory focal point and district fields are enforced and reported
 *
 * Feature: registry-self-registration   Route: :8445 /onboarding
 *
 * NOT ONE FIELD `required` IN THE WHOLE FORM. Every input on the Company Data step reports
 * `required: false`, so the browser will never stop a submission and there are no asterisks to
 * read. Enforcement lives entirely in the click handler. That makes this case the one that proves
 * the mandatory set exists at all — and it walks the fields in the order the handler checks them,
 * because it stops at the first failure and a case that filled things in a different order would
 * silently test the same rule several times.
 *
 * THE SECOND ASSERTION IS THE POINT. It is not enough that an incomplete form is refused; the
 * refusal has to SAY something. An enabled "Verify & Continue" that neither advances nor explains
 * is the worst outcome for an applicant, because there is nothing to distinguish it from a broken
 * page — and this suite very nearly filed exactly that as a P1 after reading the DOM a few seconds
 * too late. The message is a transient toast; it is captured by observer, from the instant of the
 * click, and asserted from that capture.
 *
 * The Track & Trace focal point matters beyond form-filling: they are the named human EDA contacts
 * about this company's serialisation. A registration completed without one leaves a company in the
 * registry that nobody is accountable for.
 *
 * Writes nothing — each submission is refused client-side, so the platform is never called.
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

const VALID_GLN = '6220001716418'
const VALID_GCP = '6221042'

test('REG_SRG_008 — Validate that the mandatory focal point and district fields are enforced and reported', async ({
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

  // Confirm the premise: the platform, not the browser, is what enforces this.
  const anyRequired = await page.evaluate(() =>
    Array.from(document.querySelectorAll('#tnt-body input, #tnt-body select')).some(
      (e) => (e as HTMLInputElement).required,
    ),
  )
  expect(
    anyRequired,
    'no field is marked required in the page itself, which is why the handler has to enforce the ' +
      'mandatory set and why it has to report what is missing',
  ).toBe(false)

  // 1. District, with a valid GLN and GCP so nothing earlier can claim the refusal.
  await fillCompanyData(page, { gln: VALID_GLN, gcp: VALID_GCP })
  let outcome = await submitCompanyData(page)
  expect(
    outcome.requestSent,
    `an unselected district must not be submitted. PUT answered ${outcome.putStatus}.`,
  ).toBe(false)
  expect(
    outcome.toasts.join(' | '),
    'a missing district should be reported as a required field rather than leaving the button ' +
      `apparently inert. Captured: ${outcome.toasts.join(' | ') || '(nothing)'}`,
  ).toMatch(/required/i)

  // 2. Then the focal-point identity, once the geography is satisfied.
  await fillCompanyData(page, { governorate: 'cairo' })
  const district = await firstDistrictValue(page)
  expect(district, 'the Cairo governorate should offer at least one district').not.toBeNull()
  await fillCompanyData(page, { district: district as string })

  outcome = await submitCompanyData(page)
  expect(
    outcome.requestSent,
    `a registration with no named focal point must not be submitted — they are the human EDA ` +
      `holds accountable for this company's serialisation. PUT answered ${outcome.putStatus}.`,
  ).toBe(false)
  expect(
    outcome.toasts.join(' | '),
    'a missing focal point name should be reported as a required field. Captured: ' +
      `${outcome.toasts.join(' | ') || '(nothing)'}`,
  ).toMatch(/required/i)

  // 3. Then contact details.
  await fillCompanyData(page, {
    focalPointNameEn: QA_FOCAL_POINT.focalPointNameEn,
    focalPointNameAr: QA_FOCAL_POINT.focalPointNameAr,
  })
  outcome = await submitCompanyData(page)
  expect(
    outcome.requestSent,
    `a focal point with no e-mail or phone must not be submitted — a contact nobody can reach is ` +
      `not a contact. PUT answered ${outcome.putStatus}.`,
  ).toBe(false)
  expect(
    outcome.toasts.join(' | '),
    `missing contact details should be reported. Captured: ${outcome.toasts.join(' | ') || '(nothing)'}`,
  ).toMatch(/required/i)

  // 4. And finally the job titles, which are mandatory in BOTH languages.
  await fillCompanyData(page, {
    focalPointEmail: QA_FOCAL_POINT.focalPointEmail,
    focalPointPhone: QA_FOCAL_POINT.focalPointPhone,
    nationalId: '29001011234567',
    nationalIdExpiry: '01/2030',
    jobTitleEn: QA_FOCAL_POINT.jobTitleEn,
  })
  outcome = await submitCompanyData(page)
  expect(
    outcome.requestSent,
    `the Arabic job title is mandatory too — the registry is bilingual, so a half-filled ` +
      `bilingual pair must not be accepted. PUT answered ${outcome.putStatus}.`,
  ).toBe(false)
  expect(
    outcome.toasts.join(' | '),
    `a missing Arabic job title should be reported. Captured: ${outcome.toasts.join(' | ') || '(nothing)'}`,
  ).toMatch(/required/i)
})
