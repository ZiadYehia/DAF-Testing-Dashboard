/**
 * BIL_PAY_006 — Validate that manual payment is not available to a manufacturer, in the interface and in the API
 *
 * Feature: billing-payments   Portal: https://192.168.225.195:8446 → "📄 Invoices" → row "💰 Pay"
 *
 * Checks that the platform, not the interface, is what withholds manual settlement from a
 * manufacturer — and that the invoice is still unpaid afterwards.
 *
 * Manual payment is real: the portal bundle ships `manualBtn`, `confirmManual`, `toastManualPaid`
 * and, decisively, `errManualRestricted`. So the interesting question is not whether the button
 * is drawn, it is whether the restriction is enforced where it counts. A case that only asserted
 * the missing button would pass against a build that had merely hidden it client-side, which is
 * exactly the failure the feature's own Edge Cases warn about.
 *
 * Runs in two depths. By default it is read-only: it opens the chooser and reads the API, which
 * shows manual payment is not OFFERED. With EPTTS_ALLOW_PAYMENT_WRITE set it also asks the
 * platform to settle the invoice manually and requires a refusal, which shows it is ENFORCED.
 * That second half is opt-in because if the platform is wrong it settles a real invoice on a
 * shared tenant and there is no unpay — so the invoice chosen is the lowest-value pending one,
 * and a run without the flag annotates itself rather than implying it checked more than it did.
 */
import { expect, test } from '@playwright/test'
import { BillingPage } from '../../pages/eptts-web/billing.page'
import { stateFor } from '../../lib/apps'

test.use({
  storageState: stateFor('eptts-billing'),
  ignoreHTTPSErrors: true,
})

interface MethodsResponse {
  invoiceId: string
  methods: { code: string; displayName: string }[]
}

/** Money as cents, from a cell like "3038.00 EGP", for choosing the cheapest invoice. */
function cents(cell: string): number {
  const m = /(\d+(?:\.\d+)?)/.exec(cell.replace(/,/g, ''))
  return m ? Math.round(Number(m[1]) * 100) : Number.POSITIVE_INFINITY
}

test('BIL_PAY_006 — Validate that manual payment is not available to a manufacturer, in the interface and in the API', async ({
  page,
}) => {
  test.slow()

  // Capture the session's bearer from the portal's own traffic, before anything loads.
  //
  // THE PROBE IN STEP 3 IS WORTHLESS WITHOUT THIS. The billing API authenticates with
  // `Authorization: Bearer`, not cookies — verified against a live request — so a fetch sent with
  // `credentials: 'include'` and no header is simply unauthenticated. It would be refused 401,
  // which satisfies "the platform refused" while proving nothing at all about role scoping. The
  // case has to ask as a genuine, signed-in manufacturer and be told no.
  let bearer: string | undefined
  page.on('request', (req) => {
    const header = req.headers()['authorization']
    if (header && req.url().includes('/masar-service/api/v1/')) bearer = header
  })

  const billing = BillingPage.openAs(page, 'manufacturer', '📄 Invoices')
  await billing.expectShell()

  const invoices = await billing.readInvoices()
  const pending = invoices
    .filter((r) => /pending/i.test(r['Status'] ?? ''))
    .sort((a, b) => cents(a['Total'] ?? '') - cents(b['Total'] ?? ''))
  test.fixme(
    pending.length === 0,
    'No invoice with status Pending exists for this MAH. Run WEB_CSV_009 to raise one. ' +
      'Blocked on test data, not failed.',
  )

  // The cheapest pending invoice, because step 3 asks the platform to settle it and the whole
  // case rests on that being refused. If the refusal ever stops happening, the damage should be
  // as small as the tenant allows.
  const invoice = pending[0]
  const invoiceNo = invoice['Invoice #']

  const methodsPromise = page.waitForResponse(
    (r) => r.url().includes('/billing/payment-methods') && r.request().method() === 'GET',
    { timeout: 30_000 },
  )
  await billing.openPayDialog(invoiceNo)
  const body = (await (await methodsPromise).json()) as MethodsResponse

  // 1. The chooser offers no manual option.
  const labels = body.methods.map((m) => m.displayName)
  await billing.expectPaymentMethods(labels)
  expect(
    labels.some((l) => /manual/i.test(l)),
    'the chooser must not render a manual settlement option for a manufacturer',
  ).toBe(false)

  // 2. The API omits the code, which is where the entitlement actually lives.
  expect(
    body.methods.map((m) => m.code),
    `GET /billing/payment-methods for ${invoiceNo} must omit MANUAL for this role`,
  ).not.toContain('MANUAL')

  await billing.cancelPayDialog()

  // 3. And the platform refuses a manual settlement asked for directly.
  //
  // GATED, unlike the negative cases in the API suite. Those send refusal-expected requests to
  // production freely, and that is fine because a refused EPCIS event moves nothing. This one is
  // different in kind: if the platform ACCEPTS it, a real invoice is marked paid on a tenant
  // other people use, and there is no unpay. So the probe that would expose a genuine
  // privilege-escalation runs only when the operator has opted in.
  //
  // Steps 1 and 2 above still run either way and are worth having on their own — but they only
  // prove the entitlement is absent from the interface and from the method list, not that it is
  // enforced. The annotation records that difference instead of letting a green tick imply more
  // than was checked.
  if (!process.env.EPTTS_ALLOW_PAYMENT_WRITE) {
    test.info().annotations.push({
      type: 'not-probed',
      description:
        'The direct manual-settlement attempt was NOT sent. Only the chooser and the ' +
        'payment-methods response were checked, so this run shows manual payment is not OFFERED ' +
        'to a manufacturer, not that it is REFUSED. Set EPTTS_ALLOW_PAYMENT_WRITE=1 to probe the ' +
        'server-side check — it settles a real invoice if the platform is wrong, which is the ' +
        'whole point and also the reason it is opt-in.',
    })
    return
  }

  expect(
    bearer,
    'no Authorization header was seen on the portal traffic, so the probe below could only be ' +
      'sent unauthenticated — and a 401 would prove nothing about role scoping',
  ).toBeTruthy()

  // Sent from inside the page, carrying the session's real bearer, so the platform is answering
  // a signed-in manufacturer rather than an anonymous caller.
  const invoiceId = body.invoiceId
  const attempt = await page.evaluate(
    async ({ id, auth }: { id: string; auth: string }) => {
      const base = (window as unknown as { __masarPortalEnv?: { apiBase?: string } })
        .__masarPortalEnv?.apiBase
      if (!base) return { error: 'runtime env not found on the page' }
      try {
        const res = await fetch(`${base}/billing/invoices/${id}/pay`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: auth },
          body: JSON.stringify({ method: 'MANUAL' }),
        })
        return { status: res.status, body: (await res.text()).slice(0, 400) }
      } catch (err) {
        return { error: String(err) }
      }
    },
    { id: invoiceId, auth: bearer as string },
  )

  // A transport failure is not evidence of a refusal — say so rather than counting it as a pass.
  expect(
    'error' in attempt ? `request could not be sent: ${attempt.error}` : 'sent',
    'the manual-settlement attempt has to reach the platform for its refusal to mean anything',
  ).toBe('sent')

  const status = (attempt as { status: number }).status
  const detail = (attempt as { body: string }).body

  // 401 is a FAILED PROBE, not a pass. It means the bearer was rejected outright, so the request
  // never reached the authorisation decision this case is about. Called out separately because
  // a blanket "4xx is fine" assertion is exactly how a broken probe reports success forever.
  expect(
    status,
    `the probe was refused 401, so it was not recognised as a signed-in manufacturer and says ` +
      `nothing about whether MANUAL is role-restricted. Body: ${detail}`,
  ).not.toBe(401)

  expect(
    status,
    `a manual settlement of ${invoiceNo} by a manufacturer must be refused, not accepted. ` +
      `The platform answered ${status}: ${detail}`,
  ).toBeGreaterThanOrEqual(400)

  // 4. Whatever it answered, the invoice must still be unpaid.
  await page.reload()
  await billing.goTo('📄 Invoices').expectInvoiceStatus(invoiceNo, 'Pending')
})
