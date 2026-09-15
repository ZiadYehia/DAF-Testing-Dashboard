/**
 * Master Data Registry portal (:8445) — parties, prefixes, products and pharmacy registration.
 *
 * A third page object rather than an extension of DashboardPage or BillingPage, because this
 * portal is a third thing again: its own Keycloak client (`registry-portal`), its own shell
 * (`nav[aria-label="Master Data Registry"]` / `aside.sidebar`), and — unlike the billing portal —
 * it IS partly URL-addressable, via `?tab=parties` / `?tab=products`. The `:8444` dashboard
 * redirects `/products` here as `?tab=products`, which the feature docs do not mention.
 *
 * Plain functions, not a FluentPage subclass. The registration flow ends by handing back
 * CREDENTIALS — a username, a generated password and an agent activation key — and a fluent chain
 * has nowhere to put a return value.
 *
 * WHAT THE FORM ACTUALLY IS, measured 2026-09-09. `registry-register-pharmacy/workflow.md`
 * documents 13 `rp-*` fields; there are 31 ids on the page. The extra ones change the shape of the
 * whole feature, because the pharmacy's LOGIN is created by this one submission rather than
 * afterwards through Parties → Accounts:
 *
 *   rp-gen-account   checkbox  generate a login account
 *   rp-user-email    email     the account's username
 *   rp-user-pw       password  "leave blank to auto-generate"
 *   rp-gen-key       checkbox  generate an AGENT ACTIVATION key (16-char, 30-day expiry)
 *   rp-map           div       the required LOCATION PIN — a Leaflet map
 *   rp-lat / rp-lng  span      where the pin's coordinates are displayed, not inputs
 *
 * `rp-gen-key` is NOT the B2B API key. It pairs the pharmacy's desktop agent. The 64-hex B2B key
 * is a separate, per-row action on Parties (🔑 B2B Key) which the platform cannot re-display once
 * issued, only replace.
 *
 * NO FIELD IS `required`. Every one reports `required: false`, so mandatory-field enforcement is
 * server-side. A validation case must submit and read the response; it cannot rely on the browser
 * refusing to submit. The fields the form marks with `*` are GLN, Pharmacy name, Governorate,
 * Phone, Address, Tax ID and the location pin.
 *
 * `rp-gln` is maxlength 13 and `rp-prefix` maxlength 12, but neither carries a `pattern`, so the
 * inputs do not reject non-numeric text on their own.
 */
import { expect, type Page } from '@playwright/test'
import { ensureLoggedIn } from '../../lib/auth'

/** The portal's sidebar entries. Administration is admin-only; the inspector sees the rest. */
export type RegistryNav =
  | '🏢 Parties'
  | '🔢 Prefixes'
  | '📦 Products'
  | '➕ Register Pharmacy'
  | '⚙️ Administration'

/** What a registration produced, as displayed once on success. */
export interface RegisteredPharmacy {
  gln: string
  name: string
  /** The full text of the panel after submission, so a case can quote the platform. */
  panel: string
  username: string | null
  password: string | null
  /** The agent activation key, when one was issued. Named loosely for historical reasons. */
  apiKey: string | null
}

/** Open the registry portal, logged in. */
export async function openRegistry(page: Page): Promise<void> {
  await ensureLoggedIn(page, 'eptts-registry', '/')
  await expect(
    page.locator('nav[aria-label="Master Data Registry"], aside.sidebar').first(),
    'the registry portal shell should render',
  ).toBeVisible({ timeout: 45_000 })
}

/**
 * Click a sidebar entry.
 *
 * Matched on a fragment rather than the full label because every entry carries a LIVE COUNT —
 * `🏢 Parties (87825)`, `🔢 Prefixes (0)` — which changes under you. Two feature docs already
 * disagree about the same entry's text for exactly that reason, so nothing here asserts on it.
 */
export async function goToRegistryTab(page: Page, nav: RegistryNav): Promise<void> {
  const label = nav.replace(/^[^\w]+/, '').trim()
  const entry = page
    .locator('nav[aria-label="Master Data Registry"] button, nav[aria-label="Master Data Registry"] a')
    .filter({ hasText: label })
    .first()
  await expect(
    entry,
    `sidebar entry "${label}" should be present for this role — the portal hides whole sections ` +
      `per role, so its absence is a role fact rather than necessarily a defect`,
  ).toBeVisible({ timeout: 20_000 })
  await entry.click()
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
}

/** The sidebar entries this role is offered, label text only, counts stripped. */
export async function readRegistryNav(page: Page): Promise<string[]> {
  const raw = await page
    .locator('nav[aria-label="Master Data Registry"] button, nav[aria-label="Master Data Registry"] a')
    .allInnerTexts()
  return raw.map((t) => t.replace(/\s*\(\d+\+?\)\s*$/, '').replace(/\s+/g, ' ').trim())
}

/** GS1 mod-10 check digit for a 12-digit GLN payload. Weights 1,3 from the leftmost digit. */
export function glnCheckDigit(payload12: string): string {
  const d = payload12.replace(/\D/g, '')
  let sum = 0
  for (let i = 0; i < d.length; i++) sum += Number(d[i]) * (i % 2 === 0 ? 1 : 3)
  return String((10 - (sum % 10)) % 10)
}

/** True when a 13-digit GLN satisfies its own check digit. */
export function isValidGln(gln: string): boolean {
  const d = gln.replace(/\D/g, '')
  return d.length === 13 && glnCheckDigit(d.slice(0, 12)) === d[12]
}

export interface PharmacyDraft {
  gln: string
  prefix: string
  name: string
  nameAr: string
  phone: string
  address: string
  addressAr: string
  /** Required. The form marks Tax ID with a `*`, though the input carries no `required`. */
  taxId: string
  /** Ask the platform to create a login account for the pharmacy. */
  generateAccount: boolean
  /** Ask the platform to issue an AGENT ACTIVATION key (not the B2B API key). */
  generateKey: boolean
  /** The account username. Only used when generateAccount is true. */
  userEmail?: string
}

/**
 * Fill the registration form. Does NOT submit.
 *
 * The Arabic-labelled fields are filled with ASCII on purpose: `data/` is committed and the
 * test-case validator rejects Arabic text that leaks into documents, so a name captured from a
 * screenshot or an error message stays safe to paste.
 *
 * `rp-user-pw` is deliberately left blank — its own placeholder says "leave blank to
 * auto-generate", and a platform-generated password is the thing a real onboarding would produce.
 */
export async function fillPharmacyForm(page: Page, draft: PharmacyDraft): Promise<void> {
  await expect(
    page.getByRole('heading', { name: /Register New Pharmacy/i }),
    'the registration form should be open',
  ).toBeVisible({ timeout: 20_000 })

  const set = async (id: string, value: string) => {
    const field = page.locator(`#${id}`)
    if (await field.count()) await field.fill(value)
  }

  await set('rp-gln', draft.gln)
  await set('rp-prefix', draft.prefix)
  await set('rp-name', draft.name)
  await set('rp-name-ar', draft.nameAr)
  await set('rp-phone', draft.phone)
  await set('rp-address', draft.address)
  await set('rp-address-ar', draft.addressAr)
  await set('rp-taxid', draft.taxId)

  // The three dependent geography selects. Each fires an XHR, so they are set in order and the
  // first non-placeholder option is taken — the specific area is not what any case is about.
  for (const id of ['rp-area', 'rp-governorate', 'rp-district']) {
    const select = page.locator(`#${id}`)
    if (!(await select.count())) continue
    const values = await select.locator('option').evaluateAll((opts) =>
      (opts as HTMLOptionElement[]).map((o) => o.value).filter((v) => v && !/^—|^$/.test(v)),
    )
    if (values.length) {
      await select.selectOption(values[0])
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
    }
  }

  if (draft.generateAccount) {
    const box = page.locator('#rp-gen-account')
    if (await box.count()) await box.setChecked(true)
    if (draft.userEmail) await set('rp-user-email', draft.userEmail)
  }
  if (draft.generateKey) {
    // NOTE THIS IS NOT A B2B API KEY. Its label reads "Generate agent activation key (16-char,
    // 30-day expiry)" - it pairs the pharmacy's desktop agent. The 64-hex B2B key is a separate
    // thing, issued from Parties via the per-row B2B Key action.
    const box = page.locator('#rp-gen-key')
    if (await box.count()) await box.setChecked(true)
  }

  // THE LOCATION PIN IS REQUIRED, AND NOTHING SAYS SO WHEN IT IS MISSING.
  //
  // "LOCATION PIN *" is a Leaflet map (#rp-map) whose value shows in the #rp-lat / #rp-lng
  // spans - there are no lat/lng inputs to fill. Submitting without it does nothing at all: no
  // toast, no inline error, no request. The first attempt at this flow looked like a broken
  // submit button for exactly that reason. Clicking the map drops a pin and fills both spans.
  const map = page.locator('#rp-map')
  if (await map.count()) {
    await map.click()
    await expect(
      page.locator('#rp-lat'),
      'clicking the map should drop a location pin - the form cannot submit without one, and it '
        + 'reports nothing when it is absent',
    ).not.toHaveText(/^\s*\u2014?\s*$/, { timeout: 10000 })
  }
}

/**
 * Submit the form and return whatever the platform displayed.
 *
 * Credentials are scraped from the success panel because the platform shows them ONCE — the
 * registry cannot re-display an issued API key, only replace it, so anything not captured here is
 * gone. The regexes are deliberately loose: this is the first run against the panel, and a
 * missing capture should surface as a null the caller can assert on rather than a thrown selector.
 */
export async function submitPharmacyForm(
  page: Page,
  draft: PharmacyDraft,
  timeoutMs = 60_000,
): Promise<RegisteredPharmacy> {
  await page.locator('#rp-submit').click()

  // Either a success panel naming the GLN, or an error. Poll for whichever lands.
  const deadline = Date.now() + timeoutMs
  let panel = ''
  for (;;) {
    panel = (await page.locator('main').innerText().catch(() => '')).replace(/\s+/g, ' ').trim()
    if (panel.includes(draft.gln) && /success|registered|created|api key|password/i.test(panel)) break
    if (Date.now() > deadline) break
    await page.waitForTimeout(1_000)
  }

  const grab = (re: RegExp): string | null => {
    const m = re.exec(panel)
    return m ? (m[1] ?? '').trim() || null : null
  }

  return {
    gln: draft.gln,
    name: draft.name,
    panel: panel.slice(0, 1500),
    username: grab(/(?:username|user|email|login)[:\s]+([\w.+-]+@[\w.-]+)/i),
    password: grab(/password[:\s]+(\S+)/i),
    // A B2B key is a 64-char hex string on this platform.
    apiKey: grab(/\b([0-9a-f]{64})\b/i),
  }
}
