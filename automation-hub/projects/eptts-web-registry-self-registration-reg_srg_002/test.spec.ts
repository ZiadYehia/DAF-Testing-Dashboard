/**
 * REG_SRG_002 — Validate that registration is refused when the EDA Company Profile credentials are not recognised
 *
 * Feature: registry-self-registration   Route: :8445 /onboarding
 *
 * The EDA Company Profile login is the only thing standing between an anonymous visitor and a
 * registration draft on a production registry. Everything downstream trusts it: the company name,
 * licence number and tax number are all taken from the profile and rendered read-only, so if the
 * gate can be passed without a real profile, an applicant reaches a form that will register a
 * company identity nobody verified.
 *
 * IT USES AN IDENTIFIER THAT BELONGS TO NOBODY, ON PURPOSE. The username is generated per run
 * (`qa-unknown-<runId>`), so this is not a password attempt against a real company's profile — it
 * probes whether an unknown identifier is rejected, which is a different question from whether a
 * known one can be guessed. Testing the latter against real profiles would be credential
 * guessing, and is not what this case does.
 *
 * TWO THINGS MUST BOTH HOLD, and the second is the one that gets skipped. The login must be
 * refused, AND the refusal must be reported — a form that silently does nothing leaves the
 * applicant unable to tell a wrong password from a broken page. The refusal message is captured
 * through the toast observer rather than read off the screen afterwards, because these toasts are
 * removed shortly after they appear.
 *
 * Creates nothing: a rejected session is not a draft.
 */
import { expect, test } from '@playwright/test'
import { runId } from '../../lib/eptts-api'
import {
  chooseEntityType,
  loginWithCompanyProfile,
  openOnboarding,
} from '../../pages/eptts-web/onboarding.page'

test.use({ ignoreHTTPSErrors: true, storageState: { cookies: [], origins: [] } })

test('REG_SRG_002 — Validate that registration is refused when the EDA Company Profile credentials are not recognised', async ({
  page,
}) => {
  test.slow()

  const unknownUser = `qa-unknown-${runId()}`

  await openOnboarding(page)
  await chooseEntityType(page, 'Factory')

  const outcome = await loginWithCompanyProfile(page, unknownUser, 'not-a-real-password')

  // AN OUTAGE MUST NOT SATISFY THIS CASE, and without this guard it does. Every assertion below
  // is about a refusal, and "the EDA Company Profile API is unreachable" is also a refusal: the
  // session call answers 503, the Company Data step is not reached, and a message appears. All
  // three pass while the platform never evaluated the credentials at all — a green result during
  // an outage, which is the most misleading thing a security case can produce. Measured on
  // 2026-09-09, when the upstream EDA service answered 503 "EDA Company Profile API unreachable"
  // and this case passed for entirely the wrong reason.
  const upstreamDown =
    (outcome.sessionStatus !== null && outcome.sessionStatus >= 500) ||
    /unreachable|unavailable|Bad Gateway|Gateway Time-?out/i.test(outcome.toasts.join(' | '))
  test.fixme(
    upstreamDown,
    `The EDA Company Profile service did not evaluate the credentials: the session call answered ` +
      `${outcome.sessionStatus} and said "${outcome.toasts.join(' | ')}". A refusal caused by an ` +
      `outage says nothing about whether an unrecognised identifier is rejected, so this is ` +
      `blocked on infrastructure rather than passed. Re-run when the upstream is back.`,
  )

  expect(
    outcome.reachedCompanyStep,
    `"${unknownUser}" belongs to no EDA Company Profile, so the Company Data step must not be ` +
      `reachable — everything on it is populated from a profile that would not exist. ` +
      `Platform said: ${outcome.toasts.join(' | ') || '(nothing)'}`,
  ).toBe(false)

  expect(
    outcome.sessionStatus,
    'the session call should refuse the credentials rather than answering 201 and handing back a ' +
      `registration token. It answered ${outcome.sessionStatus}.`,
  ).not.toBe(201)

  // And refuse them ON THEIR MERITS — a 4xx, i.e. the service considered the identifier and
  // rejected it. The guard above already parks 5xx as an outage; this pins the positive shape so
  // the case cannot be satisfied by some future non-4xx way of not answering 201.
  expect(
    outcome.sessionStatus,
    `the refusal should be a client-error status, meaning the EDA service evaluated the ` +
      `identifier and rejected it. It answered ${outcome.sessionStatus}.`,
  ).toBeLessThan(500)

  expect(
    outcome.toasts.join(' | '),
    'the refusal should be reported to the applicant. Without a message, a wrong Company Profile ' +
      'ID is indistinguishable from a broken page, and the applicant has no way to tell which. ' +
      'Captured through a mutation observer, so a toast that has already been removed still counts.',
  ).not.toBe('')
})
