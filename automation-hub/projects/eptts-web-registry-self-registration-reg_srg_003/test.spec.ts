/**
 * REG_SRG_003 — Validate that the company identity comes from the EDA Company Profile and cannot be edited by the applicant
 *
 * Feature: registry-self-registration   Route: :8445 /onboarding
 *
 * This is the case that establishes what self-registration actually is, and it corrects the
 * assumption the feature name invites. The applicant does not declare who they are: the company
 * name, address, licence number and tax number are all rendered from the EDA Company Profile the
 * credentials belong to, above the note "From EDA Company Profile — read only". So the company
 * that gets registered is a consequence of the credentials, not of anything typed on the form.
 *
 * WHY THAT IS A SECURITY PROPERTY AND NOT A UI DETAIL. If any of those fields were editable, an
 * applicant holding one company's profile could register a *different* company's name, licence or
 * tax number into the national track-and-trace registry — a registry with no delete control. The
 * read-only rendering is the only thing preventing that, so it is asserted field by field rather
 * than by eye, on the live DOM properties, not on styling.
 *
 * It also pins the empty-field behaviour, which is a real design decision worth protecting: where
 * EDA holds nothing the field explains itself ("Not provided by EDA — please contact EDA to update
 * your profile.") instead of offering a blank box the applicant might reasonably try to fill.
 *
 * Read-only: logs in and reads. Nothing is submitted, so no draft content changes.
 */
import { expect, test } from '@playwright/test'
import { requireEnv } from '../../lib/env'
import {
  chooseEntityType,
  loginWithCompanyProfile,
  openOnboarding,
  readCompanyBlock,
} from '../../pages/eptts-web/onboarding.page'

test.use({ ignoreHTTPSErrors: true, storageState: { cookies: [], origins: [] } })

test('REG_SRG_003 — Validate that the company identity comes from the EDA Company Profile and cannot be edited by the applicant', async ({
  page,
}) => {
  test.slow()

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
    `the Company Data step should be reachable with valid EDA credentials for ${profileId}. ` +
      `The session call answered ${login.sessionStatus ?? '(no response observed)'} and the ` +
      `platform said: ${login.toasts.join(' | ') || '(nothing)'}`,
  ).toBe(true)

  const company = await readCompanyBlock(page)

  test.info().annotations.push({
    type: 'eda-profile-identity',
    description:
      `${profileId} resolves to "${company.nameEn}" — licence ${company.licenseNo}, tax ` +
      `${company.taxNo}. Whatever this says is the company that would be registered.`,
  })

  // 1. The identity is populated, not blank. An empty block would mean the applicant is
  //    registering an unnamed company.
  expect(
    company.nameEn.trim(),
    'the English company name should be populated from the EDA Company Profile — it is the ' +
      'identity being registered, and there is no field in which to supply it by hand',
  ).not.toBe('')
  expect(
    company.nameAr.trim(),
    'the Arabic company name should be populated too, because the registry is bilingual and the ' +
      'applicant cannot supply it here',
  ).not.toBe('')
  expect(company.licenseNo.trim(), 'the EDA licence number should be populated').not.toBe('')
  expect(company.taxNo.trim(), 'the company tax number should be populated').not.toBe('')

  // 2. And none of it is editable. This is the assertion that matters: the registry has no delete
  //    control, so a company name typed by the wrong applicant could not be withdrawn.
  expect(
    company.allReadOnly,
    'EVERY company identity field must be read-only. If the name, licence or tax number could be ' +
      'edited, an applicant holding one company\'s EDA profile could register a different ' +
      'company into the national registry, which offers no delete.',
  ).toBe(true)

  // 3. A field EDA does not hold explains itself rather than inviting input.
  expect(
    company.emptyFieldNotice,
    'where EDA holds no value the field should say so and point the applicant at EDA, rather ' +
      'than presenting an empty box they would try to fill in and cannot',
  ).toMatch(/EDA/i)
})
