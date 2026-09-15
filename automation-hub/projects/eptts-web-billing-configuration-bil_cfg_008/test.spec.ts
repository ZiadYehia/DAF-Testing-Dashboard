/**
 * BIL_CFG_008 — Validate that the billing mode applies live and is reported by the platform posture
 *
 * Feature: billing-configuration   Portal: https://192.168.225.195:8446 → "⚙️ Configuration"
 *
 * Checks the claim the page makes about itself — "Billing mode — applies live, no redeploy" — by
 * setting a mode and asking the BACKEND what it will now enforce, not by re-reading the dropdown.
 *
 * `GET /billing/posture` is the authority. The dropdown says what is selected; the posture says
 * what will actually gate a shipment, and those are different facts. A case that set the mode and
 * then re-read `#c-mode` would pass against a UI that had saved nothing at all.
 *
 * WRITES A TENANT-WIDE SETTING. This is the most far-reaching write in the suite: the mode governs
 * every party on devsim immediately, and Enforce blocks shipping for all of them. So:
 *
 *  - it reads the current mode FIRST and restores exactly that in a `finally`, never a hardcoded
 *    default — the tenant's normal posture is not this case's to decide;
 *  - it is gated behind EPTTS_ALLOW_BILLING_MODE_WRITE;
 *  - it deliberately toggles to SHADOW rather than Enforce. Both prove "applies live", and Shadow
 *    cannot block anyone if the restore fails, whereas leaving the tenant in Enforce would
 *    silently stop every other shipment. WEB_SHP_009 is the case that needs Enforce, and it owns
 *    that risk explicitly.
 *
 * If a run is killed between the set and the restore, this same project is the repair tool: run it
 * again and the `finally` puts the mode back.
 */
import { expect, test } from '@playwright/test'
import { BILLING_MODES, BillingPage, type BillingMode } from '../../pages/eptts-web/billing.page'
import { ensureRoleState } from '../../pages/eptts-web/roles'
import { requireEnv } from '../../lib/env'

test.use({ ignoreHTTPSErrors: true })

test('BIL_CFG_008 — Validate that the billing mode applies live and is reported by the platform posture', async ({
  browser,
}) => {
  test.slow()
  test.fixme(
    !process.env.EPTTS_ALLOW_BILLING_MODE_WRITE,
    'Changes a TENANT-WIDE setting that governs every party on devsim: the billing mode decides ' +
      'whether unpaid clearance blocks shipping. It is restored in a finally, but a killed run ' +
      'could still leave it changed. Set EPTTS_ALLOW_BILLING_MODE_WRITE=1 in automation-hub/.env ' +
      'for a deliberate run.',
  )

  const context = await browser.newContext({
    storageState: await ensureRoleState('admin', 'eptts-billing'),
    ignoreHTTPSErrors: true,
  })

  let original: BillingMode | undefined
  let billing: BillingPage | undefined

  try {
    const page = await context.newPage()
    billing = BillingPage.openAs(page, 'admin', '⚙️ Configuration')
    await billing
      .expectShell()
      .expectIdentity(requireEnv('EPTTS_WEB_ADMIN_USERNAME'), 'admin')
      // The real heading, verified live 2026-09-08. There is NO "Fee Configuration" heading on
      // this page despite workflow.md recording one - the sections are "Billing mode - applies
      // live, no redeploy", "Pricing equation - price bands", "Product catalog", "Bank account
      // (for bank transfers)" and "Other billing settings".
      .expectHeading(/Billing mode/i)

    // 1. What the tenant is set to now — the value the finally will restore.
    original = await billing.readBillingMode()
    const before = await billing.readPosture()
    expect(
      before.mode.toLowerCase(),
      'the posture and the dropdown should agree before anything is changed. If they disagree ' +
        'at rest, the page is not showing what the backend will enforce.',
    ).toBe(original)

    test.info().annotations.push({
      type: 'tenant-setting',
      description:
        `billing mode was "${original}" (posture source: ${before.source ?? 'unknown'}); ` +
        `toggling to "shadow" and restoring`,
    })

    // Pick a target that is not the current mode, preferring shadow because it blocks nobody.
    const target: BillingMode = original === 'shadow' ? 'advisory' : 'shadow'

    // 2. Apply it.
    await billing.setBillingMode(target)

    // 3. The BACKEND reports the new mode. Polled: "applies live" is a claim about propagation,
    //    and asserting once would test the click rather than the propagation.
    await expect
      .poll(async () => (await billing!.readPosture()).mode.toLowerCase(), {
        timeout: 30_000,
        intervals: [500, 1_000, 2_000],
        message:
          `the platform posture should report "${target}" after Apply mode — the page states the ` +
          `mode applies live with no redeploy`,
      })
      .toBe(target)

    const after = await billing.readPosture()

    // 4. The flags agree with the mode. `enforce` is the one that actually gates shipping, so a
    //    mode that changed name without changing enforce would be a cosmetic setting.
    expect(
      after.enforce,
      `mode "${target}" should not enforce a block — only Enforce does. Posture: ${JSON.stringify(after)}`,
    ).toBe(false)
    expect(
      after.record,
      `mode "${target}" should still record billing. Posture: ${JSON.stringify(after)}`,
    ).toBe(true)

    // 5. And it survives a reload, so it was persisted rather than held in the page.
    await page.reload()
    const reloaded = BillingPage.openAs(page, 'admin', '⚙️ Configuration')
    await reloaded.expectShell()
    expect(
      await reloaded.readBillingMode(),
      `the Configuration page should still show "${target}" after a reload`,
    ).toBe(target)
  } finally {
    // Restore the mode the tenant was found in. Wrapped so a failure here is reported rather than
    // masking the real assertion failure, and loud because a wrong mode left behind affects
    // everyone.
    if (billing && original) {
      try {
        await billing.setBillingMode(original)

        // POLLED, for the same reason the forward change is. Reading the posture once right after
        // Apply reported "FAILED TO RESTORE ... on shadow" while the tenant was in fact already
        // back on advisory — propagation just had not landed yet. A false alarm here is worse than
        // no check: it sends someone to fix nothing, and teaches them to ignore the message on the
        // day it is real.
        let restored = original
        const deadline = Date.now() + 30_000
        for (;;) {
          restored = ((await billing.readPosture()).mode.toLowerCase() || '') as BillingMode
          if (restored === original || Date.now() > deadline) break
          await new Promise((r) => setTimeout(r, 1_000))
        }

        if (restored !== original) {
          console.error(
            `[BIL_CFG_008] FAILED TO RESTORE the billing mode after 30s. The tenant is on ` +
              `"${restored}" and should be "${original}" (${BILLING_MODES[original]}). ` +
              `Set it back by hand at https://192.168.225.195:8446 → Configuration. Until then ` +
              `every party on devsim is on the wrong billing posture.`,
          )
        }
      } catch (err) {
        console.error(`[BIL_CFG_008] RESTORE THREW: ${err}. Check the tenant billing mode by hand.`)
      }
    }
    await context.close()
  }
})
