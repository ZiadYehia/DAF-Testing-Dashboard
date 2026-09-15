/**
 * Page object for the EPTTS Billing Portal (:8446).
 *
 * A sibling of DashboardPage rather than an extension of it, for three reasons that are not
 * stylistic:
 *
 *  - DashboardPage.open()/openTab() hardcode `ensureLoggedIn(page, 'eptts-web', route)`, which
 *    resolves the :8444 base URL and drives the :8444 login. Neither can reach this portal.
 *  - This portal has NO URL ROUTES. Every screen is the same `/` with a different nav button
 *    clicked, so `route`-shaped helpers (expectSurvivesReload(route), openTab(route, label))
 *    are not merely unused here, they are meaningless.
 *  - DashboardPage.expectEnglish() asserts :8444's `dir=ltr` / `lang=en` contract, established
 *    by an `EN` button during login. This portal switches language through a `<select>` labelled
 *    "Language" and already loads in English.
 *
 * THE ROLE DECIDES WHAT EXISTS, NOT JUST WHAT IS ENABLED.
 *
 * This is the single most important fact about the portal, and it is why the repo had no record
 * of a payment surface until 2026-09-08. Every earlier discovery pass ran as Platform Admin:
 *
 *   as admin         5 nav BUTTONS (adds Reports, Configuration and Bank Transfers) plus the
 *                    Dashboard link; Invoices carries a MAH GLN column and a `f-gln` filter and
 *                    lists EVERY MAH's invoices; row actions on a pending invoice are
 *                    Details / CSV / PDF / `💰 Pay` / `✕ Cancel`, and the chooser offers a third
 *                    method, `Manual settlement (admin)`.
 *   as manufacturer  2 nav buttons plus the Dashboard link; Invoices has 9 columns and no MAH
 *                    GLN; and every PENDING invoice carries a fourth row action, `💰 Pay`.
 *
 * Counted as buttons because `🏠 Dashboard` is an `<a href>` to :8444 rather than a button, and
 * expectNavItems compares buttons only. Measured 2026-09-08 — an earlier note here said five and
 * three respectively, having missed `🏦 Bank Transfers` altogether.
 *
 * Which methods `💰 Pay` then offers is decided server-side by
 * `GET /billing/payment-methods?invoiceId=<uuid>`: GEIDEA and BANK_TRANSFER for a manufacturer,
 * those two plus MANUAL for an admin. That per-role difference is the entitlement under test.
 *
 * An earlier version of this note claimed an admin cannot see `💰 Pay` at all. That was wrong,
 * and inverted: an admin sees Pay on EVERY MAH's pending invoice, plus a `✕ Cancel` the
 * manufacturer does not get. The real asymmetry is the opposite one — a manufacturer sees only
 * its own invoices, which is what BIL_INV_011 asserts.
 *
 * Consequently every assertion here that concerns the payment surface must state which role it
 * was made as, and a spec must never treat "the control is missing" as a defect without saying
 * which role it looked as.
 */
import { expect, type Locator, type Page } from '@playwright/test'
import { FluentPage } from '../../lib/framework/fluent-page'
import { ensureCapturedSession } from '../../lib/captured-state'

/**
 * The portal's nav buttons, by their accessible names. `🏠 Dashboard` is deliberately absent —
 * it is an `<a href>` out to :8444, not a nav button, so clicking it leaves the portal.
 *
 * The last three are ADMIN ONLY. A manufacturer gets two buttons (Unbilled Operations,
 * Invoices); an admin gets five, the extras being Reports, Configuration and `🏦 Bank Transfers`
 * — the last of which is where a submitted transfer is approved or rejected.
 */
export type BillingNav =
  | '🧾 Unbilled Operations'
  | '📄 Invoices'
  | '📊 Reports'
  | '⚙️ Configuration'
  | '🏦 Bank Transfers'

/**
 * The Bank Transfers table columns, in order. Admin only.
 *
 * The trailing empty string is real, not padding: the action column here is an unlabelled `<th>`,
 * where the Invoices table labels its equivalent "ACTIONS". Leaving it out made
 * expectTableColumns fail on a correct page with a diff whose only content was `+ ""`, which is a
 * confusing way to learn that two tables in one portal disagree about whether an action column
 * gets a heading.
 */
export const BANK_TRANSFER_COLUMNS = [
  'Invoice #',
  'MAH GLN',
  'Reference #',
  'Transfer date',
  'Amount',
  'Receipt',
  'Status',
  '',
] as const

/** Billing mode, exactly as the `#c-mode` option labels read. */
export const BILLING_MODES = {
  off: 'Off — no billing interaction',
  shadow: 'Shadow — record only (no invoices, no block)',
  advisory: 'Advisory — invoices visible, no block',
  enforce: 'Enforce — block shipping on unpaid clearance',
} as const

export type BillingMode = keyof typeof BILLING_MODES

/** The manufacturer's Invoices columns, in order. The admin's view adds MAH GLN after Invoice #. */
export const MFG_INVOICE_COLUMNS = [
  'Invoice #',
  'Pieces',
  'Billing charge',
  'eService',
  'Total',
  'Status',
  'Created',
  'Paid',
  'Actions',
] as const

/** The payment methods the server offers a manufacturer, by display name. */
export const MFG_PAYMENT_METHODS = [
  'Geidea (Bank Masr) — Credit/Debit Card',
  'Bank Transfer',
] as const

/**
 * The payment methods the server offers Platform Admin — the manufacturer's two plus manual
 * settlement, measured 2026-09-08.
 *
 * `Manual settlement (admin)` is the third method the bundle implements and withholds behind
 * `errManualRestricted`. Its absence from the manufacturer's list is the entitlement BIL_PAY_006
 * asserts; its presence here is what makes BIL_PAY_005 possible.
 */
export const ADMIN_PAYMENT_METHODS = [
  'Geidea (Bank Masr) — Credit/Debit Card',
  'Manual settlement (admin)',
  'Bank Transfer',
] as const

export interface BillingPosture {
  mode: string
  record: boolean
  enforce: boolean
  serviceEnabled?: boolean
  source?: string
}

export class BillingPage extends FluentPage {
  /** The session bearer, observed on the portal's own traffic. See openAs. */
  private bearer: string | undefined

  private constructor(page: Page, private readonly role: string) {
    super(page)
  }

  /**
   * Start recording this portal's toasts, so a message cannot be missed.
   *
   * THE TOASTS ARE EPHEMERAL AND NOT PRIMENG. The billing portal is a hand-rolled SPA, and its
   * notifier is literally:
   *
   *   function p(kind, text) { const n = document.createElement('div')
   *     n.className = `toast ${kind}`; n.textContent = text
   *     document.body.appendChild(n); setTimeout(() => n.remove(), 3500) }
   *
   * Two consequences. The selector is `div.toast` (`.toast.success` / `.toast.error`), NOT the
   * `.p-toast-message` used on the :8444 dashboard — a spec reusing that selector here finds
   * nothing, ever. And the node is REMOVED AFTER 3.5 SECONDS, so polling for it races the
   * timeout: a once-a-second poll that happens to be busy misses the only explanation the portal
   * ever gave. Reading a refused Geidea payment as "the portal displayed no message at all" was
   * exactly that.
   *
   * A MutationObserver installed before the action catches every toast regardless of how briefly
   * it lives. Re-installed per call so each action reports only its own messages.
   */
  private async captureToasts(): Promise<void> {
    await this.page.evaluate(() => {
      const w = window as unknown as { __eptts_toasts?: string[]; __eptts_obs?: MutationObserver }
      w.__eptts_toasts = []
      w.__eptts_obs?.disconnect()
      const obs = new MutationObserver((records) => {
        for (const rec of records) {
          rec.addedNodes.forEach((node) => {
            if (!(node instanceof HTMLElement)) return
            if (!node.classList.contains('toast')) return
            const kind = [...node.classList].filter((c) => c !== 'toast').join('/') || 'toast'
            w.__eptts_toasts!.push(`[${kind}] ${(node.textContent ?? '').trim()}`)
          })
        }
      })
      obs.observe(document.body, { childList: true })
      w.__eptts_obs = obs
    })
  }

  /** Everything captureToasts has seen since it was installed. */
  private async readToasts(): Promise<string[]> {
    return this.page.evaluate(
      () => (window as unknown as { __eptts_toasts?: string[] }).__eptts_toasts ?? [],
    )
  }

  /**
   * The platform's own statement of the billing gate, from `GET /billing/posture`.
   *
   * This is the authority, not the `#c-mode` dropdown. The dropdown shows what is selected in the
   * UI; the posture is what the backend will actually enforce, and the two are exactly the pair a
   * "mode applies live" case has to compare. It answers e.g.
   * `{"mode":"advisory","record":true,"enforce":false,"serviceEnabled":true,"source":"default(advisory)"}`
   * — note `source`, which distinguishes an explicitly-set mode from the default.
   *
   * ADMIN ONLY, and the refusal is explicit: to a manufacturer it answers
   * `403 Access denied. This endpoint is available to: Daf admin, support, Finance.`
   * It is also 404 on :8444 — it exists only on the billing portal's own API, despite an older
   * bug report citing the dashboard host.
   */
  async readPosture(): Promise<BillingPosture> {
    if (!this.bearer) {
      throw new Error(
        'No Authorization header was observed on the portal traffic, so the posture cannot be ' +
          'read. openAs registers the listener, so this means no API call has happened yet.',
      )
    }
    const result = await this.page.evaluate(async (auth: string) => {
      const base = (window as unknown as { __masarPortalEnv?: { apiBase?: string } })
        .__masarPortalEnv?.apiBase
      const res = await fetch(`${base}/billing/posture`, { headers: { Authorization: auth } })
      return { status: res.status, body: await res.text() }
    }, this.bearer)
    if (result.status !== 200) {
      throw new Error(
        `GET /billing/posture answered ${result.status} for role "${this.role}": ${result.body}. ` +
          `It is restricted to Daf admin, support and Finance.`,
      )
    }
    return JSON.parse(result.body) as BillingPosture
  }

  /**
   * Accept the next native confirm() dialog, for exactly one action.
   *
   * EVERY WRITE IN THIS PORTAL IS GATED BY window.confirm, AND PLAYWRIGHT DISMISSES DIALOGS BY
   * DEFAULT. That combination is silent: the click lands, the confirm is auto-dismissed, the
   * handler takes its `else` branch, and nothing happens — no error, no toast, no request. A spec
   * that does not handle the dialog reports "the status never changed" and sends you looking for
   * a backend fault that is not there. It cost a full debugging cycle on BIL_PAY_004.
   *
   * The four confirmed sites, read from the portal bundle:
   *   bankTransfers.queue.confirmApprove   approving a submitted transfer
   *   invoices.toast.confirmPayManual      paying an invoice (manual and hosted both)
   *   dues.confirmGeidea / confirmManual   bulk settling from the dues page
   *   config.billingMode.confirmEnforce    setting the billing mode to Enforce, only
   *
   * `once`, not `on`, and armed immediately before the action rather than for the whole test:
   * a blanket handler would also swallow a confirm the page should not have raised, and an
   * unexpected extra prompt is a finding rather than something to auto-accept.
   */
  private acceptNextConfirm(): void {
    this.page.once('dialog', (dialog) => {
      void dialog.accept()
    })
  }

  /**
   * Open the portal as a role whose session was captured by hand, and select a nav item.
   *
   * Must stay a plain sync function returning the instance — see the thenable-assimilation note
   * in lib/framework/fluent-page.ts. An `async` version resolves to `void` and the next call in
   * the chain throws on `undefined`.
   *
   * Uses ensureCapturedSession rather than ensureLoggedIn because this account is behind TOTP:
   * a re-login attempt cannot succeed, and failing with the capture command is far more useful
   * than a timeout on whatever locator came next.
   */
  static openAs(page: Page, role: string, nav?: BillingNav): BillingPage {
    const self = new BillingPage(page, role)
    return self.step(async () => {
      // Record the session's bearer as the portal uses it. readPosture() needs it, and there is
      // no other way to get one: the token lives in a JS closure, never in localStorage or a
      // cookie, so it can only be observed on the wire.
      page.on('request', (req) => {
        const header = req.headers()['authorization']
        if (header && req.url().includes('/masar-service/api/v1/')) self.bearer = header
      })
      await ensureCapturedSession(page, 'eptts-billing', role)
      await page
        .locator('nav[aria-label="Billing Portal"], aside')
        .first()
        .waitFor({ state: 'visible', timeout: 45_000 })
      if (nav) await self.clickNav(nav)
    })
  }

  /**
   * Click a nav item and wait for its data call to settle.
   *
   * `🏠 Dashboard` is intentionally not a valid argument: it is an <a href> pointing at :8444,
   * so clicking it navigates OUT of the portal. Typing it as unreachable is cheaper than
   * debugging a spec that mysteriously ends up on the dashboard.
   */
  private async clickNav(nav: BillingNav): Promise<void> {
    const button = this.page.getByRole('button', { name: nav, exact: true })
    await expect(
      button,
      `nav item "${nav}" should be present for role "${this.role}" — the portal hides whole ` +
        `sections per role, so its absence is a role fact, not necessarily a defect`,
    ).toBeVisible({ timeout: 20_000 })
    await button.click()
    await this.page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
  }

  /** Select a nav item mid-chain. */
  goTo(nav: BillingNav): this {
    return this.step(() => this.clickNav(nav))
  }

  /** The portal shell rendered at all. */
  expectShell(): this {
    return this.step(async () => {
      await expect(this.page.getByRole('heading', { name: 'Billing Portal', level: 1 })).toBeVisible()
    })
  }

  /**
   * The header states who we are and in what role.
   *
   * Worth asserting rather than assuming: the whole page is role-shaped, so a spec that quietly
   * ran as the wrong identity would produce a plausible-looking wrong answer — an absent
   * `💰 Pay` button reads identically to "payment is broken".
   */
  expectIdentity(email: string, platformRole: string): this {
    return this.step(async () => {
      await expect(
        this.page.getByText(`${email} · ${platformRole}`),
        `the portal header should show "${email} · ${platformRole}"`,
      ).toBeVisible()
    })
  }

  /** The nav holds exactly these items — the role's whole menu, no more. */
  expectNavItems(expected: readonly BillingNav[]): this {
    return this.step(async () => {
      const actual = await this.page
        .locator('nav[aria-label="Billing Portal"] button')
        .allInnerTexts()
      const norm = (s: string) => s.replace(/\s+/g, ' ').trim()
      expect(
        actual.map(norm).sort(),
        `nav items for role "${this.role}"`,
      ).toEqual([...expected].map(norm).sort())
    })
  }

  expectHeading(text: string | RegExp): this {
    return this.step(async () => {
      await expect(this.page.getByRole('heading', { name: text }).first()).toBeVisible()
    })
  }

  /**
   * Table columns, compared on trimmed text.
   *
   * Compared case-INSENSITIVELY on purpose. The headers render Title Case ("Billing charge") but
   * every workflow.md in data/ records them ALL CAPS, because the admin-era discovery read them
   * after a CSS text-transform. Asserting the raw case would make this fail against its own
   * documentation for a purely presentational reason.
   */
  expectTableColumns(expected: readonly string[]): this {
    return this.step(async () => {
      const actual = await this.page.locator('table thead th').allInnerTexts()
      expect(actual.map((c) => c.trim().toLowerCase())).toEqual(
        expected.map((c) => c.trim().toLowerCase()),
      )
    })
  }

  /** The row for one invoice number, located via its `<code>` cell. */
  invoiceRow(invoiceNo: string): Locator {
    return this.page.locator('table tbody tr').filter({ hasText: invoiceNo })
  }

  /**
   * Assert one invoice's status.
   *
   * Matched case-INSENSITIVELY, deliberately. The status lives in
   * `<span class="tag pending_approval">Pending</span>` under `text-transform: uppercase`, so the
   * DOM text is `Pending` while the rendered text is `PENDING`. Playwright's text engine reads
   * the DOM text and would match `'Pending'`; `allInnerTexts()` reads the rendered text and
   * returns `'PENDING'`. Both are used in this file, and an exact matcher would therefore be
   * correct in one place and silently wrong in the other. An anchored, case-insensitive regex is
   * right under either reading — while still anchored, so "Pending" cannot satisfy a check for
   * a status that merely contains it.
   */
  expectInvoiceStatus(invoiceNo: string, status: string): this {
    return this.step(async () => {
      const row = this.invoiceRow(invoiceNo)
      await expect(row, `invoice ${invoiceNo} should be listed`).toBeVisible({ timeout: 20_000 })
      await expect(
        row.getByText(new RegExp(`^\\s*${status}\\s*$`, 'i')),
        `invoice ${invoiceNo} should read status "${status}"`,
      ).toBeVisible()
    })
  }

  /**
   * Wait for an invoice to reach a status, re-fetching the list each time.
   *
   * SETTLEMENT IS ASYNCHRONOUS, and the invoice list does not poll itself. Approving a bank
   * transfer returns promptly, but the invoice was observed flipping to Paid a little later — so
   * a plain expect() against the already-rendered table fails on a correct platform, and the
   * table it is staring at would never update anyway. Each attempt therefore re-clicks the nav
   * item, which re-issues GET /billing/invoices.
   *
   * This is the opposite problem to the import-jobs table on :8444, which polls so eagerly that
   * its rows cannot be clicked. Same portal family, opposite failure.
   */
  waitForInvoiceStatus(invoiceNo: string, status: string, timeoutMs = 60_000): this {
    return this.step(async () => {
      await expect
        .poll(
          async () => {
            await this.clickNav('📄 Invoices')
            const row = (await this.readInvoices()).find((r) => r['Invoice #'] === invoiceNo)
            return (row?.['Status'] ?? '(not listed)').trim()
          },
          {
            timeout: timeoutMs,
            intervals: [1_000, 2_000, 3_000, 5_000],
            message:
              `invoice ${invoiceNo} should reach status "${status}". Settlement is asynchronous, ` +
              `so this polls rather than asserting once.`,
          },
        )
        .toMatch(new RegExp(status, 'i'))
    })
  }

  /** Open the payment-method chooser for one invoice. */
  openPayDialog(invoiceNo: string): this {
    return this.step(async () => {
      const pay = this.invoiceRow(invoiceNo).getByRole('button', { name: '💰 Pay' })
      await expect(
        pay,
        `invoice ${invoiceNo} should offer "💰 Pay" — it renders only for the MAH that owes the ` +
          `invoice, and only while the invoice is PENDING`,
      ).toBeVisible({ timeout: 20_000 })
      await pay.click()
      await expect(
        this.page.getByRole('heading', { name: 'Choose a payment method' }),
      ).toBeVisible({ timeout: 15_000 })
    })
  }

  /**
   * The chooser offers exactly these methods.
   *
   * Scoped to the dialog, and compared as a whole set rather than per-method, so an EXTRA method
   * fails too. That direction matters more than the obvious one: `MANUAL` appearing here for a
   * manufacturer would be a privilege-scope defect, and a per-method `toBeVisible()` loop would
   * never notice it.
   */
  expectPaymentMethods(expected: readonly string[]): this {
    return this.step(async () => {
      const dialog = this.payDialog()
      const buttons = await dialog.getByRole('button').allInnerTexts()
      const methods = buttons.map((b) => b.trim()).filter((b) => b && !/^(cancel|×)$/i.test(b))
      expect(methods.sort(), `payment methods offered to role "${this.role}"`).toEqual(
        [...expected].sort(),
      )
    })
  }

  /**
   * The dialog element.
   *
   * `div.dialog` (the portal is a hand-rolled SPA, not PrimeNG like :8444, and exposes no
   * `role="dialog"` — only the class, plus a sibling `div.dialog-backdrop`), narrowed by the
   * heading so it cannot silently match a different dialog if the portal grows another one.
   *
   * The narrowing is the point. Selecting on the class alone would be a latent mis-target the
   * day a second dialog exists; selecting on the heading alone — walking every `div` that
   * contains it and taking the last — happens to work but depends on DOM nesting order, which is
   * exactly the kind of thing a layout change breaks for no visible reason.
   */
  private payDialog(): Locator {
    return this.page
      .locator('div.dialog')
      .filter({ has: this.page.getByRole('heading', { name: 'Choose a payment method' }) })
  }

  /**
   * Choose a payment method. THIS COMMITS A REAL PAYMENT ON A REAL INVOICE.
   *
   * Left as a primitive rather than wrapped into payByGeidea()/payByBankTransfer() helpers,
   * because what happens after the click is not yet verified and differs per method:
   *
   *  - Geidea reports `supportsHostedCheckout: true, supportsDirectCharge: false`, so it should
   *    redirect to a Geidea-hosted card page with 3DS. Whether devsim points at Geidea's test
   *    mode or at live Bank Masr is unknown; the bundle also carries a `GEIDEA_ENABLED=false`
   *    string, most likely the text of its unavailable message.
   *  - Bank Transfer is not a payment at all. It opens a form that DISPLAYS beneficiary name,
   *    address, bank, account number, IBAN and SWIFT, and COLLECTS a reference number, transfer
   *    date, amount and a mandatory receipt upload. The submission lands PENDING and an admin
   *    then approves or rejects it, so the invoice only becomes Paid in a second, different
   *    session as a different role.
   *
   * Writing convenience wrappers around unverified flows would bake guesses into the page object
   * where they are hardest to see. The spec drives the rest explicitly until each is observed.
   */
  choosePaymentMethod(method: string): this {
    return this.step(async () => {
      const button = this.payDialog().getByRole('button', { name: method, exact: true })
      await expect(button, `payment method "${method}" should be offered`).toBeVisible()
      // Geidea and Manual both raise confirm("invoices.toast.confirmPay*") before they act.
      // Bank Transfer opens a form instead and raises nothing, so this handler simply goes
      // unused there -- `once` expires with the test rather than leaking into the next action.
      this.acceptNextConfirm()
      await button.click()
    })
  }

  /**
   * The bank-transfer form, once "Bank Transfer" has been chosen.
   *
   * Unlike the chooser, this dialog has stable ids throughout — `#bt-reference`, `#bt-date`,
   * `#bt-receipt`, `#bt-cancel`, `#bt-close` — so it is addressed by them.
   *
   * Note what it does NOT collect: the amount. The bundle's payload carries `amountCents`, but
   * the form derives it from the invoice and states it in prose ("Transfer 14.00 EGP for invoice
   * …"). There is nothing to fill and nothing to get wrong.
   */
  expectBankTransferForm(invoiceNo: string): this {
    return this.step(async () => {
      const dialog = this.page.locator('div.dialog')
      await expect(
        dialog.getByRole('heading', { name: 'Pay by Bank Transfer' }),
      ).toBeVisible({ timeout: 15_000 })

      // The form states which invoice it is settling. Worth asserting: the chooser is opened
      // from a row, and a form that had latched onto a different invoice would submit a
      // correct-looking transfer against the wrong debt.
      await expect(
        dialog,
        `the bank transfer form should name invoice ${invoiceNo}`,
      ).toContainText(invoiceNo)

      // The beneficiary account the payer is told to transfer to. Asserted as present rather
      // than by value — these are real bank details and belong in neither a spec nor data/ —
      // but their absence is a defect: a transfer form with no destination cannot be acted on.
      for (const label of [
        'Beneficiary name',
        'Bank name',
        'Account number',
        'IBAN',
        'SWIFT / BIC',
      ]) {
        await expect(
          dialog,
          `the form should show "${label}" so the payer knows where to send the money`,
        ).toContainText(label)
      }
    })
  }

  /**
   * Fill and submit a bank transfer claim. THIS CREATES A REAL RECORD FOR FINANCE REVIEW.
   *
   * It does NOT settle the invoice — the submission lands PENDING and an admin approves or
   * rejects it, so the invoice stays Pending afterwards. That two-step shape is why paying by
   * bank transfer cannot be one test case.
   */
  submitBankTransfer(opts: { reference: string; date: string; receiptPath: string }): this {
    return this.step(async () => {
      const dialog = this.page.locator('div.dialog')
      await dialog.locator('#bt-reference').fill(opts.reference)
      await dialog.locator('#bt-date').fill(opts.date)
      await dialog.locator('#bt-receipt').setInputFiles(opts.receiptPath)
      await dialog.getByRole('button', { name: 'Submit for review' }).click()
    })
  }

  /**
   * Dismiss the bank-transfer form without submitting.
   *
   * `#bt-cancel`, not a role lookup: the `×` carries `aria-label="Cancel"` too, so
   * `getByRole('button', { name: 'Cancel' })` is a strict-mode violation here — verified.
   */
  cancelBankTransfer(): this {
    return this.step(async () => {
      await this.page.locator('#bt-cancel').click()
    })
  }

  /**
   * Choose Geidea and follow the hosted checkout as far as it goes.
   *
   * Returns where it ended up, because that is the thing under test and it is not knowable up
   * front. The portal's own admin help says: "Geidea: redirects to hosted checkout (works in stub
   * mode if GEIDEA_ENABLED=false)" — so on a tenant without a live PSP the redirect is expected to
   * be a stub rather than a real Bank Masr card page. This method does not assume which.
   *
   * Two things worth knowing before asserting on the result:
   *  - Card payment ADDS AN ESERVICE FEE. The confirm text has two forms, `confirmPayHosted` and
   *    `confirmPayHostedWithFee`, so the amount finally charged can exceed the invoice total.
   *    A case comparing the paid total to the original total must allow for that.
   *  - Geidea cannot be initiated by the SUPPORT role at all (`errGeideaSupport`: "ask the MAH
   *    user to run that flow"), so this is a manufacturer-only path even though an admin sees the
   *    button.
   */
  async payByGeidea(invoiceNo: string, timeoutMs = 60_000): Promise<{
    leftPortal: boolean
    url: string
    paid: boolean
    /** Whatever the portal said — a redirect notice, a settlement notice, or an error. */
    message: string
  }> {
    const portalOrigin = new URL(this.page.url()).origin

    // COLLECT TOASTS, because the failure path is a toast and nothing else.
    //
    // The bundle's handler is:
    //   const d = await pay(id, {gateway}); if (d.redirectUrl) { toast(redirectingTo); location.href = ... }
    //   else { toast(paidHoldInProgress); ... } catch (e) { toast('error', String(e)) }
    //
    // So a refused payment neither navigates nor settles — it only raises an error toast. A poll
    // that watches the URL and the invoice status alone therefore reports a bare 60s timeout and
    // throws away the one thing that explains it. That is exactly what happened the first time
    // this ran, and the reason the platform's own words are captured here.
    // Capture the pay call itself. The toast says "Internal server error" and nothing more, so
    // the status and body are the only things that make a bug report actionable.
    const payCalls: string[] = []
    const onResponse = (res: import('@playwright/test').Response) => {
      if (!/\/billing\/invoices\/[^/]+\/pay$/.test(res.url())) return
      void res
        .text()
        .then((body) => payCalls.push(`${res.request().method()} ${res.status()} ${body.slice(0, 300)}`))
        .catch(() => payCalls.push(`${res.request().method()} ${res.status()} (body unreadable)`))
    }
    this.page.on('response', onResponse)

    await this.captureToasts()
    this.acceptNextConfirm()
    await this.payDialog()
      .getByRole('button', { name: 'Geidea (Bank Masr) — Credit/Debit Card', exact: true })
      .click()

    const deadline = Date.now() + timeoutMs
    for (;;) {
      const url = this.page.url()
      if (!url.startsWith(portalOrigin)) {
        return { leftPortal: true, url, paid: false, message: [...(await this.readToasts()), ...payCalls].join(' | ') }
      }
      const row = (await this.readInvoices()).find((r) => r['Invoice #'] === invoiceNo)
      if (row && /paid/i.test(row['Status'] ?? '')) {
        return { leftPortal: false, url, paid: true, message: [...(await this.readToasts()), ...payCalls].join(' | ') }
      }
      if (Date.now() > deadline) {
        const seen = [...(await this.readToasts()), ...payCalls]
        return {
          leftPortal: false,
          url,
          paid: false,
          message: seen.length ? seen.join(' | ') : '(the portal displayed no toast at all)',
        }
      }
      await this.page.waitForTimeout(1_000)
    }
  }

  /** Dismiss the chooser without paying. */
  cancelPayDialog(): this {
    return this.step(async () => {
      await this.payDialog().getByRole('button', { name: 'Cancel' }).last().click()
      await expect(
        this.page.getByRole('heading', { name: 'Choose a payment method' }),
      ).toBeHidden({ timeout: 10_000 })
    })
  }

  /** A paid invoice must offer no way to pay it again. */
  expectNoPayAction(invoiceNo: string): this {
    return this.step(async () => {
      const row = this.invoiceRow(invoiceNo)
      await expect(row, `invoice ${invoiceNo} should be listed`).toBeVisible({ timeout: 20_000 })
      await expect(
        row.getByRole('button', { name: '💰 Pay' }),
        `invoice ${invoiceNo} is not PENDING, so it must not offer "💰 Pay"`,
      ).toHaveCount(0)
    })
  }

  /**
   * Filter the invoice list by status and apply.
   *
   * `#f-status` is confirmed present for the manufacturer as well as for admin. The fallback
   * matches on a select that actually OFFERS the wanted option, rather than on "the first
   * combobox" — the page carries exactly two selects, and the first of them is `#lang-switch`,
   * so a positional fallback would quietly switch the interface to Arabic and then fail on a
   * locator somewhere unrelated.
   */
  filterByStatus(label: string): this {
    return this.step(async () => {
      const byId = this.page.locator('#f-status')
      const select = (await byId.count())
        ? byId
        : this.page.locator('select').filter({ has: this.page.locator(`option[value], option`) })
            .filter({ hasText: label })
            .first()
      await expect(
        select,
        `a status filter offering "${label}" should be present on the invoice list`,
      ).toHaveCount(1)
      await select.selectOption({ label })
      await this.page.getByRole('button', { name: 'Apply' }).click()
      await this.page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
      await this.waitForListSettled()
    })
  }

  /**
   * Wait until the invoice list has finished re-rendering after a filter.
   *
   * THIS IS NOT BELT-AND-BRACES, IT FIXES A SILENT WRONG ANSWER. An empty result removes the
   * whole `<table>` from the DOM rather than emptying its body, and a refetch therefore passes
   * through a window where the table is simply absent. `waitForLoadState('networkidle')` returns
   * inside that window, so reading the rows immediately afterwards yielded ZERO — measured: 7
   * rows before filtering to Paid, 0 straight after, 6 when the same filter was applied by hand
   * with a pause. BIL_PAY_007 consequently skipped itself with "this MAH has no Paid invoice"
   * while six paid invoices were sitting there, which is the worst kind of failure: a case that
   * quietly reports there is nothing to test.
   *
   * Settled means one of the two real end states is on screen — a table, or the explicit
   * "no invoices match" message. Anything else is mid-render.
   */
  private async waitForListSettled(timeoutMs = 20_000): Promise<void> {
    const table = this.page.locator('table')
    const emptyState = this.page.getByText(/No invoices match the current filter/i)
    const deadline = Date.now() + timeoutMs
    for (;;) {
      if (await table.isVisible().catch(() => false)) return
      if (await emptyState.isVisible().catch(() => false)) return
      if (Date.now() > deadline) {
        throw new Error(
          'The invoice list never settled after applying a filter: neither a table nor the ' +
            '"No invoices match the current filter." message appeared within ' +
            `${Math.round(timeoutMs / 1000)}s.`,
        )
      }
      await this.page.waitForTimeout(250)
    }
  }

  /**
   * Read the invoice list as data, for arithmetic assertions.
   *
   * Money is returned as the raw cell text ("3038.00 EGP") rather than parsed to a number here:
   * the currency suffix is part of what a billing case may need to assert, and silently dropping
   * it would let a total denominated in the wrong currency compare equal.
   *
   * KEYS ARE CANONICALISED, and that is load-bearing rather than tidy. The headers are styled
   * with `text-transform: uppercase`, and `innerText` returns RENDERED text — so it yields
   * `INVOICE #`, `BILLING CHARGE`, `ESERVICE`, while the accessibility tree reports the
   * underlying `Invoice #`, `Billing charge`, `eService`. Keying on the raw read therefore built
   * records that no caller could index: `row['Invoice #']` came back `undefined`, every amount
   * parsed as empty, and an arithmetic check "passed" against nothing. Matching each header
   * case-insensitively back to MFG_INVOICE_COLUMNS gives callers the readable name and makes the
   * reader immune to a styling change in either direction.
   */
  async readInvoices(): Promise<Record<string, string>[]> {
    return this.readTable(MFG_INVOICE_COLUMNS)
  }

  /**
   * Read any of the portal's tables as data, keyed by the caller's column names.
   *
   * The column list is a PARAMETER rather than a constant, because this portal has several
   * tables and the canonicalisation is per-table. Hardcoding the invoice columns here meant that
   * reading the Bank Transfers table produced `REFERENCE #` (the rendered, uppercased header)
   * while callers asked for `Reference #` and silently got `undefined` — the same defect the
   * invoice reader already had once. Passing the expected columns in makes that impossible to
   * reintroduce for a third table.
   *
   * Unrecognised headers keep their own trimmed text rather than being dropped, so a column that
   * appears for one role and not another (the admin-only `MAH GLN` on Invoices) is still
   * readable without the caller having to know about it.
   */
  async readTable(columns: readonly string[]): Promise<Record<string, string>[]> {
    const raw = (await this.page.locator('table thead th').allInnerTexts()).map((h) => h.trim())
    const canonical = raw.map((h) => {
      const match = columns.find((c) => c.toLowerCase() === h.toLowerCase())
      return match ?? h
    })
    const rows = await this.page.locator('table tbody tr').all()
    const out: Record<string, string>[] = []
    for (const row of rows) {
      const cells = await row.locator('td').allInnerTexts()
      const rec: Record<string, string> = {}
      canonical.forEach((h, i) => (rec[h] = (cells[i] ?? '').trim()))
      out.push(rec)
    }
    return out
  }

  /**
   * The pending invoice raised by one CSV import — the invoice for THIS run's packs.
   *
   * WHY THIS EXISTS. The payment cases originally took "the cheapest pending invoice", which is
   * not the invoice the run created and on a shared tenant is usually somebody else's entirely.
   * That broke the whole point of the chain: import → invoice → pay → ship has to follow one
   * consignment, or paying proves nothing about the stock being shipped.
   *
   * HOW THE LINK IS MADE, and why it is sound. Billing raises one invoice per un-invoiced batch
   * of packing operations, so an import of N packs yields a pending invoice whose Pieces is N.
   * Measured 2026-09-08: a 4-pack import produced INV-20260908-000018, 4 pieces, 28.00 EGP —
   * exactly 4 × the 7.00 EGP band fee.
   *
   * THE ONE CAVEAT THAT MADE THIS LOOK IMPOSSIBLE AT FIRST. While an earlier invoice is still
   * PENDING, new packing is absorbed into it rather than raising a new one: INV-20260908-000002
   * was watched growing 434 → 473 → 654 → 662 pieces across a day. So the 1:1 relationship only
   * holds when the MAH has no unpaid invoice at the time of the import. When it does, this
   * returns null rather than guessing, and the caller should say so instead of paying a
   * 662-piece invoice to settle its own four packs.
   *
   * `createdAfter` guards against matching a same-sized invoice from an earlier run.
   */
  async findInvoiceForImport(
    packCount: number,
    createdAfter: Date,
    ownGln?: string,
  ): Promise<Record<string, string> | null> {
    const rows = await this.readInvoices()
    const candidates = rows.filter((r) => {
      if (!/pending/i.test(r['Status'] ?? '')) return false
      if (Number((r['Pieces'] ?? '').replace(/\D/g, '')) !== packCount) return false
      // The MAH GLN column exists only in the admin view; skip the check when it is absent,
      // because a manufacturer only ever sees its own invoices anyway (BIL_INV_011).
      if (ownGln && r['MAH GLN'] !== undefined && r['MAH GLN'] !== ownGln) return false
      const created = new Date(r['Created'] ?? '')
      return !Number.isNaN(created.getTime()) && created >= createdAfter
    })
    // Newest first, so a rerun picks its own rather than a previous run's identical invoice.
    candidates.sort((a, b) => Date.parse(b['Created'] ?? '') - Date.parse(a['Created'] ?? ''))
    return candidates[0] ?? null
  }

  /**
   * The MAH's outstanding clearance as one number, with the invoice it sits on.
   *
   * THIS IS THE SHAPE THE BILLING GATE ACTUALLY USES, which is why it is worth having alongside
   * findInvoiceForImport. Enforce does not reason about consignments — it refuses a dispatch with
   * "Shipping blocked by unpaid invoices. Outstanding cents: N", i.e. on the MAH's BALANCE. So a
   * case about the gate wants the balance, not a per-import invoice.
   *
   * It also survives folding, which findInvoiceForImport deliberately refuses to. Reading the
   * balance before an import and again after lets a case prove the new packs are inside the
   * unpaid clearance — Pieces grew by exactly the number imported — whether billing raised a
   * fresh invoice or absorbed them into a pending one. That is stronger evidence of attribution
   * than matching a piece count, because it is a measured delta rather than an assumption about
   * how billing batches.
   *
   * Returns pieces 0 and invoiceNo null when nothing is outstanding.
   */
  async readOutstandingFor(
    ownGln: string,
  ): Promise<{ invoiceNo: string | null; pieces: number }> {
    const pending = await this.unpaidRowsFor(ownGln)
    const pieces = pending.reduce(
      (sum, r) => sum + Number((r['Pieces'] ?? '').replace(/\D/g, '') || 0),
      0,
    )
    // Newest first, so the invoice reported is the one a fresh import would fold into.
    pending.sort((a, b) => Date.parse(b['Created'] ?? '') - Date.parse(a['Created'] ?? ''))
    return { invoiceNo: pending[0]?.['Invoice #'] ?? null, pieces }
  }

  /** The unpaid invoice rows belonging to one MAH. Shared by the balance read and the settler. */
  private async unpaidRowsFor(ownGln: string): Promise<Record<string, string>[]> {
    await this.clickNav('📄 Invoices')

    // FILTER SERVER-SIDE FIRST. The list renders one page at a time behind a `#load-more` button
    // ("29 invoices on this page · No more results"), so summing the rendered rows silently
    // undercounts as soon as the tenant outgrows a page — and it is a shared tenant, so other
    // MAHs' invoices are what push ours off. Narrowing to one MAH via `#f-gln` keeps the whole
    // answer on the first page. The filter exists only in the admin view; a manufacturer sees
    // nothing but its own invoices anyway (BIL_INV_011).
    const glnFilter = this.page.locator('#f-gln')
    if (await glnFilter.count()) {
      await glnFilter.fill(ownGln)
      await this.page.locator('#apply').click()
      await this.page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
      await this.waitForListSettled()
    }

    // PENDING is not the only unpaid state — `#f-status` also offers OVERDUE, and an invoice that
    // has aged past its due date is still money owed and still something Enforce should hold.
    // Counting only PENDING would report a zero balance for a MAH whose debt had merely got old.
    return (await this.readInvoices()).filter(
      (r) =>
        /pending|overdue/i.test(r['Status'] ?? '') &&
        // The MAH GLN column exists only in the admin view; see readInvoices/BIL_INV_011.
        (r['MAH GLN'] === undefined || r['MAH GLN'] === ownGln),
    )
  }

  /**
   * Settle every PENDING invoice owed by one MAH, by manual admin settlement, and report which
   * ones were paid. ADMIN ONLY, IRREVERSIBLE, and it moves real money-state on a shared tenant.
   *
   * THIS IS A PRECONDITION HELPER, NEVER AN ASSERTION. It exists because of the folding rule
   * findInvoiceForImport documents: while an invoice is PENDING, later packing is absorbed into
   * it rather than raising its own. So a case that needs "this manufacturer owes nothing" cannot
   * get there by paying one invoice matched on piece count — the piece count is the sum of
   * everything unbilled, and its own packs are buried inside a total it did not create. A zero
   * balance is the only precondition that can actually be established.
   *
   * Why a case would need that: under Enforce, ANY outstanding clearance blocks EVERY dispatch by
   * that MAH — the platform refuses with "Shipping blocked by unpaid invoices. Outstanding cents:
   * N", naming the balance and not the consignment. So a case whose subject lies downstream of a
   * dispatch (receiving, dispensing) cannot reach its own subject while a balance exists.
   * Settling is the honest way in. Flipping the tenant to Advisory would also work and is worse:
   * it changes a global setting for every party on devsim to arrange one case's setup.
   *
   * Re-reads the list on each pass rather than iterating a snapshot, because settling one invoice
   * re-renders the table and can reveal another that folding had hidden. The bound of 20 means a
   * misread status can never turn this into an unbounded payment loop.
   */
  async settleAllPendingFor(ownGln: string): Promise<string[]> {
    const settled: string[] = []
    for (let pass = 0; pass < 20; pass++) {
      const next = (await this.unpaidRowsFor(ownGln)).find(
        (r) => !settled.includes(r['Invoice #'] ?? ''),
      )?.['Invoice #']
      if (!next) return settled

      await this.openPayDialog(next)
      await this.choosePaymentMethod('Manual settlement (admin)')
      await this.waitForInvoiceStatus(next, 'Paid')
      settled.push(next)
    }
    return settled
  }

  /**
   * Assert an invoice's Details dialog covers a given number of operations.
   *
   * The Details dialog (`div.dialog.wide`) is where billing states WHICH operations an invoice
   * bills: a `Lines` table of GTIN / unit price / band fee / qty, and an
   * `Operations covered (N)` table of operation id / type / GTIN / pieces / status / timestamp.
   * That table is the only place the platform joins a packing operation to the invoice charging
   * for it, so it is the strongest available evidence that an invoice belongs to an import.
   */
  expectInvoiceCoversOperations(invoiceNo: string, operationCount: number): this {
    return this.step(async () => {
      await this.invoiceRow(invoiceNo).getByRole('button', { name: '📋 Details' }).click()
      const dialog = this.page.locator('div.dialog')
      await expect(
        dialog.getByText(`Invoice ${invoiceNo}`),
        `the Details dialog should be showing invoice ${invoiceNo}`,
      ).toBeVisible({ timeout: 15_000 })
      await expect(
        dialog,
        `invoice ${invoiceNo} should report covering ${operationCount} operation(s)`,
      ).toContainText(`Operations covered (${operationCount})`)
      await dialog.locator('#close-foot, #close').first().click()
    })
  }

  /** A bank-transfer row, located by the reference number the payer submitted. Admin only. */
  bankTransferRow(reference: string): Locator {
    return this.page.locator('table tbody tr').filter({ hasText: reference })
  }

  /** Assert a submitted transfer's review state, e.g. 'Pending review' / 'Approved'. */
  expectBankTransferStatus(reference: string, status: string): this {
    return this.step(async () => {
      const row = this.bankTransferRow(reference)
      await expect(row, `bank transfer ${reference} should be listed`).toBeVisible({
        timeout: 20_000,
      })
      await expect(
        row.getByText(new RegExp(`^\\s*${status}\\s*$`, 'i')),
        `bank transfer ${reference} should read "${status}"`,
      ).toBeVisible()
    })
  }

  /**
   * Approve a submitted bank transfer. ADMIN ONLY, AND THIS SETTLES A REAL INVOICE.
   *
   * Approval is the step that turns a claim into a payment: the invoice becomes Paid and its
   * billing hold is released. There is no un-approve.
   */
  approveBankTransfer(reference: string): this {
    return this.step(async () => {
      // Native confirm("bankTransfers.queue.confirmApprove") gates this; without accepting it the
      // click is a silent no-op. See acceptNextConfirm.
      this.acceptNextConfirm()
      await this.bankTransferRow(reference).getByRole('button', { name: /Approve/ }).click()
      await this.page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
    })
  }

  /** Reject a submitted bank transfer, with a reason. Admin only. */
  rejectBankTransfer(reference: string): this {
    return this.step(async () => {
      this.acceptNextConfirm()
      await this.bankTransferRow(reference).getByRole('button', { name: /Reject/ }).click()
      await this.page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
    })
  }

  /**
   * Set the tenant-wide billing mode. ADMIN ONLY, AND GLOBAL.
   *
   * "Billing mode — applies live, no redeploy" is the page's own description, and it means what
   * it says: this changes behaviour for every party on the tenant immediately, not just for the
   * caller. A spec that sets it owes a restore in a `finally`, and the mode it restores to must
   * be read first — never assumed.
   */
  setBillingMode(mode: BillingMode): this {
    return this.step(async () => {
      await this.page.locator('#c-mode').selectOption({ label: BILLING_MODES[mode] })
      // Only 'enforce' raises confirm("config.billingMode.confirmEnforce"), but arming it for
      // every mode is harmless and means the one destructive setting cannot be the one that was
      // forgotten.
      this.acceptNextConfirm()
      await this.page.getByRole('button', { name: 'Apply mode' }).click()
      await this.page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
    })
  }

  /** The currently selected billing mode, as a key of BILLING_MODES. */
  async readBillingMode(): Promise<BillingMode> {
    const label = await this.page.locator('#c-mode option:checked').innerText()
    const found = (Object.keys(BILLING_MODES) as BillingMode[]).find(
      (k) => BILLING_MODES[k] === label.trim(),
    )
    if (!found) {
      throw new Error(
        `Unrecognised billing mode "${label.trim()}" — expected one of: ` +
          Object.values(BILLING_MODES).join(' | '),
      )
    }
    return found
  }
}
