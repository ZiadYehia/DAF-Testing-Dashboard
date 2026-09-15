# billing-configuration — Feature Knowledge

## Why this feature matters

The price-band table decides what every partner is charged. Changing a band changes real invoices, which makes this both high-impact and a write surface to be careful with.

## What will bite you

- **Band edges are the critical cases**: a price exactly equal to a band's `from` or `to` must fall in
  exactly one band. Off-by-one here mis-bills every partner at that price point.
- Verify overlapping and gapped bands are rejected.
- Editing a band is a **production write** affecting billing — prefer read and validation cases.

## What every case here has to account for

- **The Citrix VPN is a hard precondition.** Nothing on `192.168.225.195` resolves without it, and a
  dropped VPN looks exactly like a hung server: every request fails after a uniform ~10 s connect
  timeout. Rule that out before diagnosing anything.
- **TLS is a self-signed certificate.** Playwright needs `ignoreHTTPSErrors: true` (including in
  `browser.newContext()`, which does *not* inherit it from the config's `use` block), the Playwright
  MCP server needs `--ignore-https-errors`, curl needs `-k`, and Postman needs SSL verification off.
- **Two unrelated auth systems.** The dashboard is Keycloak OIDC (realm `masar`, client
  `masar-dashboard`, Authorization Code + PKCE); the B2B API is an `apikey` exchanged for a
  15-minute bearer token. A change to one cannot affect the other. Keycloak's direct password grant
  is **disabled**, so dashboard automation must drive the real browser login.
- **Secrets never go in `data/`.** It is committed. Reference the env key name
  (`EPTTS_MFG_APIKEY`), never the value.

## Case history and provenance

Per-case history for this feature: where each case came from, what the source
spreadsheet recorded, and what this project actually verified. Kept here rather than in
the test-case table, which holds only the 13 columns.

### Verification status

**Not yet executed against production.** Every case is `Under Testing` / `new_added`.

The source spreadsheet recorded these statuses against **staging**, by a different tester: Under Testing 7. Those are retained here as history only — they are not evidence of coverage in this environment, so they are deliberately not carried into the Status column.

### BIL_CFG_008 - BIL_CFG_009, added 2026-09-08

Written from live discovery against devsim on 2026-09-08.

**`BIL_CFG_009` is only meaningful because the page is role-gated at the navigation level.**
Logged in as the manufacturer the billing portal renders three nav items - Dashboard, Unbilled
Operations, Invoices - and neither Reports nor Configuration appears at all. The case therefore
checks the platform refuses the action, not merely that the menu entry is hidden, which is the
distinction every `workflow.md` in this module already asks for under Edge Cases.

**`BIL_CFG_008` mutates a tenant-wide setting and must restore it.** The page states "Billing
mode - applies live, no redeploy", and it means every party on devsim, immediately. The case
reads the mode from the platform first, changes it, asserts, and restores the value it read -
never a hardcoded default, because the tenant's normal posture is not ours to decide. It is
gated behind `EPTTS_ALLOW_BILLING_MODE_WRITE` so a bulk run records it blocked rather than
changing the tenant, and it doubles as the repair tool if a killed run leaves the mode wrong.

The four `#c-mode` options map to the posture endpoint as follows: `GET /billing/posture`
answers `{"mode":...,"enforce":...,"record":...}`, so Advisory is `enforce:false, record:true`
and Enforce is `enforce:true`. `WEB_SHP_009`/`WEB_SHP_010` are the cases that prove the mode
actually gates shipping, and they read the posture rather than trusting the dropdown.

Note the known inverted-gate defect this may surface, documented at
`data/eptts-api/bugs/api-unpacking/billing-enforces-a-hold-on-unpacking-while-posture-is-advisory-ngrok-relay.md`:
with `enforce:false` a billing hold still refused an unpacking event while shipping of the same
SSCC succeeded. Assert what the mode is specified to do and mark a real gap with an
expected-failure marker; never assert the observed behaviour.

## How the shipping gate actually decides, measured 2026-09-09

**The gate is balance-based, not consignment-based.** Enforce refuses a dispatch with
`Error Shipping blocked by unpaid invoices. Outstanding cents: 5600` — it names the MAH's total
and holds *every* dispatch by that MAH while anything is owed, rather than reasoning about the
packs being shipped. A case that wants to exercise the gate therefore needs an unpaid balance and
some stock to move; it does not need the balance to be attributable to its own packs, and
`WEB_SHP_009` was rebuilt around that after an earlier version demanded a matching per-import
invoice and could not run whenever the MAH already owed something.

**Invoices are raised on a slow asynchronous sweep, and this is the important part.** Every
invoice carries an `idempotencyKey` of the form `settle:<hash>`, the Unbilled Operations tab lists
packing operations awaiting that sweep, and there is no operator control to trigger it. Measured:
a completed 4-pack import left the balance untouched through a full 4-minute poll, and
`INV-20260909-000027` was watched growing 8 → 12 → 16 → 20 → 24 pieces, one 4-pack import per
step, each step landing only after the run that caused it had finished.

Two consequences:

1. **Folding.** While an invoice is `PENDING`, later packing is absorbed into it rather than
   raising its own, so the 1:1 relationship between an import and an invoice holds only when the
   MAH owed nothing at the time. `findInvoiceForImport` returns `null` instead of guessing;
   `readOutstandingFor` and `settleAllPendingFor` are the folding-tolerant alternatives.
2. **A window in which the gate cannot act.** Between packing and the sweep, the stock exists and
   nothing is invoiced, so Enforce has nothing to hold. Two dispatches were observed completing
   under a confirmed `enforce:true` within seconds of their clearance being raised, while the same
   dispatch against a balance hours old was correctly refused. Since pack-then-ship is the normal
   working sequence, this is the common path rather than a rare race. Filed as
   `bugs/web-shipping/billing-enforce-does-not-see-freshly-raised-clearance-so-pack-then-ship-bypasses-the-hold.md`
   and covered by `WEB_SHP_012`.

A retracted claim, kept here so it is not re-derived: a bug asserting that Enforce never blocks
shipping was filed on 2026-09-08 and has been **deleted**. Enforce does block — `WEB_SHP_009`
passes on invoiced debt. What it cannot see is clearance the sweep has not yet turned into an
invoice.

**Unpaid is not only `PENDING`.** `#f-status` also offers `OVERDUE`, and aged debt is still money
owed, so a balance read that counts only `PENDING` reports zero for a MAH whose debt merely got
old. The admin invoice list also pages behind a `#load-more` button, so summing rendered rows
undercounts on a shared tenant; narrow with `#f-gln` first.

