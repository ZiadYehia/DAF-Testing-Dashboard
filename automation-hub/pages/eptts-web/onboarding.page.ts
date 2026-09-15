/**
 * Self-registration on the registry portal (:8445 /onboarding) — "Track & Trace Entities
 * Registration".
 *
 * THE ONLY UNAUTHENTICATED EPTTS SURFACE. Every other page in this suite needs a Keycloak session;
 * this one cannot, because an applicant has no platform account yet. So nothing here goes through
 * `ensureLoggedIn`, and a spec that tried would hang on a login that must not be required.
 *
 * IT IS NOT OPEN SELF-REGISTRATION, WHICH CHANGES WHAT CAN BE TESTED. The flow authenticates the
 * applicant against their existing **EDA Company Profile** and then collects only the Track &
 * Trace data EDA does not hold. The company block is rendered "From EDA Company Profile — read
 * only", so the company that gets registered is whichever one the credentials belong to — there is
 * no field in which to name a different company. A case cannot therefore choose its subject; it
 * inherits it from the credentials in `EPTTS_EDA_PROFILE_ID`.
 *
 * Plain functions rather than a FluentPage subclass: nearly every step needs to return what the
 * platform said, and a fluent chain has nowhere to put a return value.
 *
 * ERRORS ARE TRANSIENT TOASTS, AND THIS IS THE MOST IMPORTANT THING IN THIS FILE. Validation
 * failures render as `div.toast.error` and are removed again shortly after. Reading the DOM a few
 * seconds after clicking finds nothing at all — no message, no invalid field, no request — which
 * is indistinguishable from an enabled button that does nothing. That reading was wrong and nearly
 * became a filed P1: the button validates correctly and the toast fires at +0ms. So the capture is
 * ARMED BEFORE the click and reads what was observed, never what is currently on screen. Same
 * mistake, same shape, as the billing portal's 3500ms toasts.
 *
 * Measured against devsim on 2026-09-09. Validation rules, read from `/assets/boot-DXlc52c7.js`
 * rather than guessed:
 *   GLN         /^\d{13}$/                    "GLN must be exactly 13 digits."
 *   GCP         /^\d{4,12}$/                  "GCP is required (4–12 digits)."
 *   National ID /^\d{14}$/                    "National ID Number must be exactly 14 digits."
 *   Expiry      /^(0[1-9]|1[0-2])\/\d{4}$/    "Expiry date must be in MM/YYYY format."
 * plus district, focal-point names, e-mail, phone and job titles, each reported as "This field is
 * required." The handler stops at the FIRST failure, so a form with several gaps reports them one
 * at a time — a case that wants to prove a specific rule must satisfy every rule before it.
 *
 * None of the checks reach the network: `PUT /onboarding/registration/company` is called only once
 * all of them pass. So the negative cases here write nothing at all, which is why they are safe to
 * run repeatedly against a production tenant.
 */
import { expect, type Page } from '@playwright/test'
import { requireEnv } from '../../lib/env'

/** The six entity types the flow offers, and what each one is for. */
export const ENTITY_TYPES = {
  Factory: 'Manufactures its own products.',
  Toll: 'Manufactures on behalf of another company.',
  Importer: 'Imports already-manufactured products.',
  Distributor: 'Distributes products to the market.',
  Wholesaler: 'Sells products wholesale.',
  Warehouse: 'Stores and handles products.',
} as const

export type EntityType = keyof typeof ENTITY_TYPES

/** The company identity, as EDA holds it. Every one of these is read-only on screen. */
export interface CompanyBlock {
  nameEn: string
  nameAr: string
  addressEn: string
  addressAr: string
  licenseNo: string
  taxNo: string
  /** True only when the platform renders every one of the above as non-editable. */
  allReadOnly: boolean
  /** What a field EDA does not hold says instead of being blank. */
  emptyFieldNotice: string
}

/** The applicant-supplied half of the Company Data step. */
export interface CompanyData {
  gln?: string
  gcp?: string
  governorate?: string
  district?: string
  focalPointNameEn?: string
  focalPointNameAr?: string
  focalPointEmail?: string
  focalPointPhone?: string
  nationalId?: string
  nationalIdExpiry?: string
  jobTitleEn?: string
  jobTitleAr?: string
}

/**
 * Placeholder focal-point values, for reaching a LATER validation rule.
 *
 * `Ke()` stops at the first failing rule, so a case that wants to prove the national-ID rule must
 * first satisfy GLN, GCP, district, names, e-mail and phone. These exist only to get past those.
 *
 * SAFE BECAUSE THEY NEVER LEAVE THE BROWSER. Validation runs entirely client-side and
 * `PUT /onboarding/registration/company` is reached only once EVERY rule passes — so in a negative
 * case, which by construction fails one, nothing is transmitted or stored. They are deliberately
 * self-identifying rather than plausible: if one of these ever does appear in the registry, it
 * means a negative case submitted when it should not have, and that is worth noticing immediately.
 * They are NOT a stand-in for a real applicant's details in the positive case.
 */
export const QA_FOCAL_POINT = {
  focalPointNameEn: 'QA DO NOT USE',
  focalPointNameAr: 'اختبار لا تستخدم',
  focalPointEmail: 'qa-do-not-use@example.invalid',
  focalPointPhone: '01000000000',
  jobTitleEn: 'QA Placeholder',
  jobTitleAr: 'اختبار',
} as const

const FIELD_IDS: Record<keyof CompanyData, string> = {
  gln: '#tnt-gln',
  gcp: '#tnt-gcp',
  governorate: '#tnt-gov',
  district: '#tnt-dist',
  focalPointNameEn: '#tnt-fp-name-en',
  focalPointNameAr: '#tnt-fp-name-ar',
  focalPointEmail: '#tnt-fp-email',
  focalPointPhone: '#tnt-fp-phone',
  nationalId: '#tnt-fp-nid',
  nationalIdExpiry: '#tnt-fp-nid-exp',
  jobTitleEn: '#tnt-fp-title-en',
  jobTitleAr: '#tnt-fp-title-ar',
}

/**
 * Wait up to `ms` for a locator to become visible, and report rather than throw.
 *
 * NOT `locator.isVisible({ timeout })`, WHICH DOES NOT WAIT. That call is a non-retrying snapshot:
 * the `timeout` option does nothing, so it answers for the DOM as it stands at that instant. Used
 * to judge "did the next step render after I clicked?", it answers before the app has rendered
 * anything and returns false — which reads as a failed login on a login that answered 201.
 */
async function visibleWithin(
  locator: ReturnType<Page['locator']>,
  ms: number,
): Promise<boolean> {
  return await locator
    .waitFor({ state: 'visible', timeout: ms })
    .then(() => true)
    .catch(() => false)
}

/** Open the registration entry point. No login, deliberately. */
export async function openOnboarding(page: Page): Promise<void> {
  const base = requireEnv('EPTTS_REGISTRY_BASE_URL')
  await page.goto(`${base}/onboarding`, { waitUntil: 'domcontentloaded' })
  await expect(
    page.getByRole('heading', { name: /Track & Trace Entities Registration/i }),
    'the onboarding page should render its heading WITHOUT a Keycloak login — an applicant has no ' +
      'platform account yet, so a redirect to a login form would make registration impossible',
  ).toBeVisible({ timeout: 45_000 })
}

/** The entity types as the page actually offers them, label mapped to its description. */
export async function readEntityTypes(page: Page): Promise<Record<string, string>> {
  return await page.evaluate(() => {
    const out: Record<string, string> = {}
    for (const b of Array.from(document.querySelectorAll('main button'))) {
      const parts = Array.from(b.children).map((c) => (c.textContent ?? '').trim())
      if (parts.length >= 2 && parts[0]) out[parts[0]] = parts[1]
    }
    return out
  })
}

export async function chooseEntityType(page: Page, type: EntityType): Promise<void> {
  await page.locator('main button').filter({ hasText: type }).first().click()
  await expect(
    page.locator('#tnt-username'),
    `choosing ${type} should lead to the EDA Company Profile login — registration is gated on an ` +
      `EDA profile rather than creating an identity from nothing`,
  ).toBeVisible({ timeout: 20_000 })
}

/**
 * Arm the toast capture. MUST be called before whatever action might produce a message.
 *
 * Collects into a page-global rather than asserting, because the toast is gone by the time any
 * later read happens. See the file header: sampling instead of observing is what made a working
 * validator look like a dead button.
 */
export async function armToastCapture(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __toasts?: string[]; __obs?: MutationObserver }
    w.__toasts = []
    w.__obs?.disconnect()
    const obs = new MutationObserver((muts) => {
      for (const m of muts) {
        for (const n of Array.from(m.addedNodes)) {
          const el = n as HTMLElement
          const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim()
          const cls = typeof el.className === 'string' ? el.className : ''
          if (text && /toast|alert|error/i.test(cls)) w.__toasts!.push(text)
        }
      }
    })
    obs.observe(document.body, { childList: true, subtree: true })
    w.__obs = obs
  })
}

/** Everything the toast capture saw since it was armed. */
export async function readToasts(page: Page): Promise<string[]> {
  return await page.evaluate(
    () => (window as unknown as { __toasts?: string[] }).__toasts ?? [],
  )
}

/**
 * Log in with EDA Company Profile credentials.
 *
 * Reports rather than asserts, so a negative case can drive an unrecognised identifier and read
 * the refusal. `reachedCompanyStep` is judged on the Company Data step actually rendering, not on
 * the absence of an error — a silent failure would otherwise look like success.
 */
export async function loginWithCompanyProfile(
  page: Page,
  username: string,
  password: string,
): Promise<{ reachedCompanyStep: boolean; toasts: string[]; sessionStatus: number | null }> {
  await armToastCapture(page)
  const sessionCall = page
    .waitForResponse(
      (r) =>
        r.url().includes('/onboarding/registration/session') && r.request().method() === 'POST',
      { timeout: 30_000 },
    )
    .catch(() => null)

  await page.locator('#tnt-username').fill(username)
  await page.locator('#tnt-password').fill(password)
  await page.getByRole('button', { name: /^Login$/ }).click()

  const response = await sessionCall
  const reachedCompanyStep = await visibleWithin(page.locator('#tnt-gln'), 20_000)

  return {
    reachedCompanyStep,
    toasts: await readToasts(page),
    sessionStatus: response ? response.status() : null,
  }
}

/** The EDA-owned company identity, and whether the platform really protects it. */
export async function readCompanyBlock(page: Page): Promise<CompanyBlock> {
  return await page.evaluate(() => {
    const byLabel = (label: string) => {
      for (const l of Array.from(document.querySelectorAll('label'))) {
        if ((l.textContent ?? '').trim().startsWith(label)) {
          const input = l.querySelector('input')
          if (input) return input as HTMLInputElement
        }
      }
      return null
    }
    const read = (label: string) => byLabel(label)
    const fields = [
      'English Company Name',
      'Arabic Company Name',
      'English Company Address',
      'Arabic Company Address',
      'License No.',
      'Company Tax No.',
    ].map(read)

    return {
      nameEn: fields[0]?.value ?? '',
      nameAr: fields[1]?.value ?? '',
      addressEn: fields[2]?.value ?? '',
      addressAr: fields[3]?.value ?? '',
      licenseNo: fields[4]?.value ?? '',
      taxNo: fields[5]?.value ?? '',
      allReadOnly: fields.every((f) => !!f && (f.readOnly || f.disabled)),
      emptyFieldNotice: fields[2]?.placeholder ?? '',
    }
  })
}

/**
 * Fill any subset of the applicant-supplied fields.
 *
 * Uses Playwright's fill/selectOption rather than assigning `.value`, because the form binds with
 * `addEventListener('input')` — a value set without dispatching the event never reaches the model,
 * and the step then validates as though the field were empty.
 */
export async function fillCompanyData(page: Page, data: CompanyData): Promise<void> {
  for (const [key, value] of Object.entries(data) as [keyof CompanyData, string][]) {
    if (value === undefined) continue
    const selector = FIELD_IDS[key]
    if (key === 'governorate' || key === 'district') {
      await page.locator(selector).selectOption(value)
      // The district list is fetched when the governorate changes, so give it a moment to arrive
      // before a later selectOption tries to pick from an empty list.
      if (key === 'governorate') await page.waitForTimeout(1_500)
    } else {
      await page.locator(selector).fill(value)
    }
  }
}

/** The first district the chosen governorate offers, or null when it offers none. */
export async function firstDistrictValue(page: Page): Promise<string | null> {
  return await page.evaluate(() => {
    const select = document.querySelector('#tnt-dist') as HTMLSelectElement | null
    if (!select) return null
    const real = Array.from(select.options).find((o) => o.value)
    return real ? real.value : null
  })
}

/**
 * Submit the Company Data step and report what the platform did.
 *
 * `requestSent` is the discriminator that matters: validation runs entirely in the browser and
 * `PUT /onboarding/registration/company` is only reached once every rule passes. So a refusal MUST
 * show `requestSent: false`, and a case asserting "nothing was saved" can prove it rather than
 * assume it.
 */
export async function submitCompanyData(page: Page): Promise<{
  toasts: string[]
  requestSent: boolean
  putStatus: number | null
  advanced: boolean
}> {
  await armToastCapture(page)
  const put = page
    .waitForResponse(
      (r) => r.url().includes('/onboarding/registration/company') && r.request().method() === 'PUT',
      { timeout: 15_000 },
    )
    .catch(() => null)

  await page.locator('#tnt-save').click()
  const response = await put
  // Read the toasts the observer captured, not the screen: by now they may already be gone.
  const toasts = await readToasts(page)
  // Advancing means the company step is GONE. Given a short grace period, because the step is
  // replaced asynchronously once the PUT resolves.
  const advanced = !(await visibleWithin(page.locator('#tnt-gln'), 5_000))

  return {
    toasts,
    requestSent: response !== null,
    putStatus: response ? response.status() : null,
    advanced,
  }
}
