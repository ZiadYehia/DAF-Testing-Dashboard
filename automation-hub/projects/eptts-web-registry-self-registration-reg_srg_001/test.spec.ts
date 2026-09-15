/**
 * REG_SRG_001 — Validate that self-registration offers the six entity types and starts without a platform login
 *
 * Feature: registry-self-registration   Route: :8445 /onboarding
 *
 * The entry point to the only unauthenticated surface in EPTTS. That is the substance of this
 * case, not a detail: an applicant company has no platform account yet, so if this page ever
 * starts requiring a Keycloak session, registration becomes impossible for exactly the people it
 * exists for. `openOnboarding` therefore navigates without any storage state at all — a spec that
 * replayed a session here could pass while the unauthenticated path was broken.
 *
 * It also pins the entity taxonomy, because the choice is not cosmetic: it is sent as `entityType`
 * on the session call and decides which steps the applicant gets (only product-bearing types
 * receive the Products step). A silently dropped or renamed type would reroute whole categories of
 * company through the wrong flow.
 *
 * Read-only throughout: no credentials, no submission, nothing created.
 */
import { expect, test } from '@playwright/test'
import { ENTITY_TYPES, openOnboarding, readEntityTypes } from '../../pages/eptts-web/onboarding.page'

test.use({ ignoreHTTPSErrors: true, storageState: { cookies: [], origins: [] } })

test('REG_SRG_001 — Validate that self-registration offers the six entity types and starts without a platform login', async ({
  page,
}) => {
  test.slow()

  // No storage state, so reaching the heading at all is the assertion that registration is open
  // to someone who has no account. openOnboarding fails loudly if a login intercepts.
  await openOnboarding(page)

  await expect(
    page.getByText(/Select your entity type to begin registration/i),
    'the page should tell an applicant what to do first',
  ).toBeVisible()

  const offered = await readEntityTypes(page)

  for (const [type, description] of Object.entries(ENTITY_TYPES)) {
    expect(
      offered[type],
      `"${type}" should be offered as an entity type — it decides which registration steps the ` +
        `applicant gets, so a missing type routes a whole category of company nowhere. ` +
        `Offered: ${Object.keys(offered).join(', ') || '(none)'}`,
    ).toBeDefined()
    expect(
      offered[type],
      `"${type}" should explain itself, because an applicant choosing between Factory, Toll and ` +
        `Importer cannot be expected to know the platform's vocabulary`,
    ).toBe(description)
  }

  expect(
    Object.keys(offered).length,
    `exactly ${Object.keys(ENTITY_TYPES).length} entity types should be offered. Offered: ` +
      `${Object.keys(offered).join(', ')}`,
  ).toBe(Object.keys(ENTITY_TYPES).length)
})
