#!/usr/bin/env node
/**
 * Generate data/eptts-web/features/<slug>/knowledge.md for every feature.
 *
 * Usage:
 *   node scripts/eptts-web-feature-knowledge.js            # dry run
 *   node scripts/eptts-web-feature-knowledge.js --write
 *
 * Feature knowledge answers what a workflow doc does not: WHY the feature matters, what
 * a tester has to understand before writing a case for it, which other feature it is
 * coupled to, and what will bite them. It is the highest-signal input the test-case
 * generator gets, so it is written for that purpose rather than as a description.
 *
 * Content is assembled from three real sources:
 *   - the verified live contract (data/eptts-web/modules/eptts-apis/knowledge/)
 *   - the XHRs each dashboard page was observed firing during Phase 4 discovery
 *   - the bugs filed under data/eptts-web/bugs/, matched to their feature
 */
const fs = require('fs')
const path = require('path')

const REPO = path.join(__dirname, '..')
const FEATURES = path.join(REPO, 'data', 'eptts-web', 'features')
const BUGS = path.join(REPO, 'data', 'eptts-web', 'bugs')
const WRITE = process.argv.includes('--write')

// ─── bugs, so each feature's knowledge names its own known defects ───────────

function bugsByFeature() {
  const out = {}
  if (!fs.existsSync(BUGS)) return out
  for (const feat of fs.readdirSync(BUGS)) {
    const d = path.join(BUGS, feat)
    if (!fs.statSync(d).isDirectory()) continue
    for (const f of fs.readdirSync(d)) {
      if (!f.endsWith('.md')) continue
      const raw = fs.readFileSync(path.join(d, f), 'utf8')
      const t = /title:\s*(?:>-\s*\n((?:\s{2}.*\n)+)|(.*))/.exec(raw)
      const title = t ? (t[1] ? t[1].replace(/\s+/g, ' ').trim() : t[2].replace(/^["']|["']$/g, '')) : f
      const p = /priority:\s*(.*)/.exec(raw)
      ;(out[feat] = out[feat] || []).push({ title, priority: p ? p[1].trim() : '', slug: f.slice(0, -3) })
    }
  }
  return out
}

// ─── the API endpoints each dashboard page was seen calling ──────────────────

function observedXhr(slug) {
  const wf = path.join(FEATURES, slug, 'workflow.md')
  if (!fs.existsSync(wf)) return []
  const md = fs.readFileSync(wf, 'utf8')
  const m = /## API calls observed\n\n.*?\n\n```\n([\s\S]*?)```/.exec(md)
  if (!m) return []
  return m[1].split('\n').map((l) => l.trim()).filter(Boolean)
}

// ─── shared context every feature needs ──────────────────────────────────────

const CROSS_CUTTING = `## What every case here has to account for

- **The Citrix VPN is a hard precondition.** Nothing on \`192.168.225.195\` resolves without it, and a
  dropped VPN looks exactly like a hung server: every request fails after a uniform ~10 s connect
  timeout. Rule that out before diagnosing anything.
- **TLS is a self-signed certificate.** Playwright needs \`ignoreHTTPSErrors: true\` (including in
  \`browser.newContext()\`, which does *not* inherit it from the config's \`use\` block), the Playwright
  MCP server needs \`--ignore-https-errors\`, curl needs \`-k\`, and Postman needs SSL verification off.
- **Two unrelated auth systems.** The dashboard is Keycloak OIDC (realm \`masar\`, client
  \`masar-dashboard\`, Authorization Code + PKCE); the B2B API is an \`apikey\` exchanged for a
  15-minute bearer token. A change to one cannot affect the other. Keycloak's direct password grant
  is **disabled**, so dashboard automation must drive the real browser login.
- **Secrets never go in \`data/\`.** It is committed. Reference the env key name
  (\`EPTTS_MFG_APIKEY\`), never the value.`

const ASYNC_CONTEXT = `## The asynchronous contract — the main source of false passes

Every write endpoint is fire-and-poll:

1. \`POST\` the EPCIS document → **\`202\`** with \`{statustype:"I", status:{code:"I001"}}\`. This means
   *queued*, not *applied*.
2. \`POST /MsgStatusQuery\` with the \`instanceIdentifier\` → poll until terminal.
3. Only then assert the resulting pack state via \`POST /VerifyProduct\`.

Three traps, each of which has already cost time here:

- The status field is **\`messagestatus\`, all lowercase**, and its value is **\`"S - Successful"\`**, not
  a bare \`SUCCESS\`. A camelCase lookup silently misses it, so the poller sees no state and times out
  while the submission actually succeeded.
- **\`404\` from MsgStatusQuery means "not ready yet"**, not failure — the body says the message "may
  still be initializing". Treating it as terminal makes every async test flake.
- A negative case can fail in **two different shapes**: a malformed document is refused
  *synchronously* with \`400\` and nothing is queued; a well-formed document that breaks a business
  rule returns \`202\` and only reports \`FAILED\` on polling. Asserting the wrong shape means the test
  passes against broken behaviour.

\`/Dispensation\` is **also asynchronous** (\`202\` then poll), despite the source spreadsheet and the
vendor Postman collection both documenting it as a synchronous \`200\`.`

const ERROR_SHAPES = `## Error envelopes differ by endpoint

There is no single "expect an error" helper, because the platform uses three formats:

| Endpoints | Shape |
|---|---|
| \`/scp/SendEPCIS\`, \`/Dispensation\` | \`{statustype:"E", status:{reason, code}}\` — codes like \`E003\` |
| \`/VerifyProduct\` | \`{logList:[{type:"E", code:"E016", message}]}\` |
| \`/epcis/json\`, \`/MsgStatusQuery\`, all registry-service | NestJS default \`{statusCode, message, error}\` |

\`normaliseError()\` in \`automation-hub/lib/eptts-api.ts\` flattens all three. Assert on the normalised
\`code\` / \`message\`, and prefer the per-event \`logList\` from MsgStatusQuery for a failure reason — a
message can complete overall while an individual event inside it fails.`

// ─── per-feature knowledge ───────────────────────────────────────────────────

const API = {
  'api-authentication': {
    why: `Every other feature in this module depends on this one endpoint, so a break here fails all 348 API cases at once. The API key also *selects the tenant*: it is simultaneously the authentication credential and the authorization identity, which is why a key that authenticates but returns the wrong \`entityGln\` would be a serious isolation defect rather than a cosmetic one.`,
    specifics: `- \`POST :8445/registry-service/api/v1/auth\`, header \`apikey\`. The vendor collection's
  \`:8444/masar-service/api/v1/auth\` is a **404 and does not exist**.
- Returns \`access_token\` (15 min), \`refresh_token\` (~7 days, not yet exercised), \`token_type: Bearer\`,
  \`expires_in: 900\`.
- Token claims: \`{sub, role, entityId, entityGln, jti, source:"b2b", principalType:"b2b_partner"}\`.
  Assert \`entityGln\` and \`role\`, not just the 200.
- **The \`apikey\` header is not needed after \`/auth\`.** Every event endpoint authenticates on
  \`Authorization: Bearer\` alone; \`apikey\` alone gives 401. The collection sends it everywhere, which
  is harmless but misleading — a case whose objective is "verify a valid/invalid API key in the
  header" belongs against \`/auth\`, nowhere else.
- **The body is optional but not ignored.** The legacy username/password path engages only when
  *both* fields are present and non-empty; then a wrong pair is 401. If either is empty, null or
  absent the credential check is skipped and the key alone authenticates.
- A valid key is mandatory: no credential pair can substitute for one, so the body can only ever
  narrow access, never widen it.`,
    gotchas: `- Keys **cannot be read back** from the platform, only replaced. They live in
  \`automation-hub/.env\`; if that file is lost they must be rotated again, which invalidates whatever
  is currently using them.
- Playwright's call log prints request headers, so a failed \`/auth\` writes the raw key to stdout and
  into \`trace.zip\`. Both are gitignored, but do not paste raw run output or share a trace.
- Proving a rotated key stops working requires rotating a live key — destructive, so \`TC_AUTH_011\`
  stays blocked until a throwaway entity exists to do it against.`,
  },
  'api-commission': {
    why: `Commissioning brings a serial number into existence. It is the origin of every traceability chain, and it must be possible **exactly once** per SGTIN — that uniqueness is what the whole system rests on. It is also the only event where master data (lot, expiry) is attached, via \`ilmd\`, and it cannot be supplied later.`,
    specifics: `- \`ObjectEvent\`, \`action: ADD\`, \`bizStep: commissioning\`, \`disposition: active\`, plus
  \`ilmd: {cbvmda:lotNumber, cbvmda:itemExpirationDate}\`.
- Only a **manufacturer** may commission, and only for a GTIN registered under its own GS1 Company
  Prefix. A branch or pharmacy attempting it is correctly refused.
- Test data must come from the acting manufacturer's own catalogue. For devsim that is
  \`MFG_GTINS\` in \`automation-hub/lib/eptts-api.ts\` (GCP length **8**, so GTIN \`08435308354487\`
  becomes \`urn:epc:id:sgtin:84353083.05448.<serial>\`).
- A successful commission leaves \`pack.status: "active"\` — lowercase, and *not* the "Commissioned"
  wording the test cases use. Assert on the API's vocabulary.`,
    gotchas: `- Every serial must be **unique per run** (\`uniqueSerial()\` produces \`ZTG<runId><n>\`). Re-using one
  turns a "commission a new pack" test into a "re-commission an existing pack" test, which is a
  different case entirely.
- Validation that IS solid and worth relying on: lot numbers are allow-listed to Latin letters,
  digits and \`- . _ /\`; a foreign SBDH sender gets \`403 "Sender GLN does not match authenticated user
  entity"\`; malformed SGLNs are named precisely; \`schemaVersion\` is pinned to \`"2.0"\`.
- Nine validation gaps found here are tracked as \`test.fail()\` — see the filed bugs. The most
  consequential cluster is that **event timestamps are not validated at all**.`,
  },
  'api-packing': {
    why: `Aggregation lets a whole container move under one identifier, and it **cascades**: shipping an SSCC moves every child pack with it. A wrong aggregation therefore corrupts every later event silently, which makes this feature's correctness a precondition for shipping, receiving and returns.`,
    specifics: `- \`AggregationEvent\`, \`action: ADD\`, \`bizStep: packing\`, with \`parentID\` (the SSCC) and \`childEPCs\`
  — **not** \`epcList\`. Getting the EPC carrier wrong is the most common authoring mistake here.
- SSCCs are minted under the manufacturer's GCP: \`ssccFor('84353083')\` → \`urn:epc:id:sscc:84353083.<9 digits>\`.
- Packing does **not** change \`pack.status\` (it stays \`active\`); what changes is \`pack.parentSscc\`.
  Assert on that, not on status.`,
    gotchas: `- **SSCC has two non-interchangeable representations.** Events carry the URN
  (\`urn:epc:id:sscc:84353083.169538028\`) while \`VerifyProduct.pack.parentSscc\` returns the 18-digit
  GS1 element string (\`184353083695380288\`). Comparing them directly makes a perfectly good
  aggregation look broken — use \`sameSscc()\` / \`ssccUrnToDigits()\`.
- Children must be commissioned first, so any packing test owns a commissioning fixture.`,
  },
  'api-unpacking': {
    why: `The mirror of packing, and distinguished from it only by \`action: DELETE\` and \`bizStep: unpacking\`. That similarity is exactly why it needs its own coverage: an implementation that confuses the two directions would still "succeed".`,
    specifics: `- \`AggregationEvent\`, \`action: DELETE\`, \`bizStep: unpacking\`, \`parentID\` + \`childEPCs\`.
- A removed child reverts to standalone; assert \`pack.parentSscc\` becomes null rather than trusting
  the message status.`,
    gotchas: `- Assert the **direction** of the change, not just SUCCESS. A test that only checks the terminal
  state cannot tell packing from unpacking.
- Unpacking every child raises a real question for the PO: is the empty SSCC deleted or retained?
- Unpacking from an SSCC that is \`in_transit\` must be refused.`,
  },
  'api-destruction': {
    why: `Destruction is **irreversible** — a destroyed pack can never re-enter the supply chain. That makes both directions matter: legitimate destruction must work, and destruction of a pack the caller does not hold must be refused, because there is no undo.`,
    specifics: `- \`ObjectEvent\`, \`action: DELETE\`, \`bizStep: destroying\`, \`disposition: destroyed\`, \`epcList\` only.
- Related decommissioning dispositions share this shape: \`stolen\`, \`lost\`, \`damaged\`, \`expired\`, and
  \`recalled\` (with \`bizStep: decommissioning\`).`,
    gotchas: `- The strongest proof a destruction took effect is that a **subsequent** operation on the pack is
  refused. Assert that, not merely the destruction's own SUCCESS.
- Every case here permanently consumes a pack, so each needs its own freshly commissioned fixture.
- Whether destroying an SSCC cascades to its children is unverified — confirm before relying on it.`,
  },
  'api-shipping': {
    why: `Shipping transfers custody and is the busiest feature in the module. It carries the richest request body — the only event with \`sourceList\`, \`destinationList\` and a \`bizTransactionList\` invoice reference — which gives it the largest mandatory-field surface and therefore the most negative cases.`,
    specifics: `- \`ObjectEvent\`, \`action: OBSERVE\`, \`bizStep: shipping\`, \`disposition: in_transit\`.
- **Custody does not move at shipping.** \`pack.status\` becomes \`in_transit\` but \`pack.currentGln\`
  stays with the *sender*; it changes only when the receiver posts the receiving event. A case that
  asserts custody moved right after shipping fails correctly.
- Routes are distinct authorization paths and each needs coverage: manufacturer→branch,
  branch→branch, branch→pharmacy.
- Return shipping reuses this shape with \`disposition: returned\`.`,
    gotchas: `- \`TC_SHIP_025\`–\`TC_SHIP_044\` were **empty reserved ID slots** in the source spreadsheet (an ID and
  \`Validity: Negative\`, nothing else). They have been authored here; see
  \`scripts/eptts-web-api-overrides.json\` for provenance.
- Ownership failures are **asynchronous**: shipping an EPC owned by another GLN returns \`202\` and only
  reports \`FAILED\` on polling. Do not expect a synchronous 403.
- The branch role is the platform's \`distributor\` role — there are zero \`branch\`-role users.`,
  },
  'api-receiving': {
    why: `Receiving is where custody actually transfers, and where discrepancies surface: a receiver claiming EPCs never shipped to it, or omitting some that were. It is the counterpart to shipping and the point at which the two parties' records must agree.`,
    specifics: `- \`ObjectEvent\`, \`action: OBSERVE\`, \`bizStep: receiving\`, \`disposition: in_progress\`, with
  \`sourceList\` naming the shipper.
- On success \`pack.status\` returns to **\`active\`** (there is no distinct "received" value) and
  \`pack.currentGln\` becomes the receiver. Assert **both** — status alone cannot show custody moved.
- Acted as the **branch** (\`distributor\` role) or the pharmacy, never the shipper.`,
    gotchas: `- \`TS_RECV_001\` is recorded \`Fail\` against \`DW-878\` in the spreadsheet. Walked end to end on
  2026-08-31 it **succeeds** — see \`automation-hub/projects/eptts-api-supply-chain/\`. Confirm with the
  DW-878 owner before closing that ticket on this evidence.
- Partial receive (fewer EPCs than shipped) raises a real question: does the shipment stay open, and
  what state do the un-received packs hold? Unverified.`,
  },
  'api-return': {
    why: `Returns send stock back upstream. Structurally this is shipping with \`disposition: returned\`, but the business rule differs in a way that matters: a return must trace back to the partner that originally supplied the pack, not to an arbitrary GLN.`,
    specifics: `- \`ObjectEvent\`, \`action: OBSERVE\`, \`bizStep: shipping\`, \`disposition: returned\`, with a return
  reference in \`bizTransactionList\` (e.g. \`RET-1001\`).
- The return reference is the handle the upstream partner's return-receiving uses, so it must be
  carried through consistently between the two features.`,
    gotchas: `- Returning to a GLN that never shipped the pack is the key negative case.
- Return Cancel exists in the vendor collection but is not among these 42 cases — a coverage gap
  worth raising.
- A returned-then-received pack becoming sellable again is the commercially significant behaviour;
  verify it deliberately rather than assuming.`,
  },
  'api-return-receiving': {
    why: `This closes the reverse-logistics loop and is the **only transition that moves packs out of a terminal-looking state back into sellable inventory**. That makes it the one place a bug can silently resurrect stock that should not be re-sold — the highest-consequence behaviour in the returns pair.`,
    specifics: `- \`ObjectEvent\`, \`action: OBSERVE\`, \`bizStep: receiving\`, \`disposition: returned\`, with \`sourceList\`
  (the returner) and the matching return reference.
- Acted as the upstream partner (manufacturer or branch).`,
    gotchas: `- The decisive question this feature answers: **may a returned-and-received pack be shipped again?**
  Cover it explicitly.
- Receiving against a closed or non-existent return reference, and receiving EPCs not part of the
  named return, are the negatives most likely to expose a weak implementation.`,
  },
  'api-dispensing': {
    why: `The terminal event of the supply chain: a pack leaves circulation as \`dispensed\`. Being terminal is what makes the negative cases matter — dispensing something already dispensed, destroyed or never received must be refused, because there is no downstream event to catch the mistake.`,
    specifics: `- \`POST /Dispensation\` (not \`/scp/SendEPCIS\`), \`ObjectEvent\`, \`action: OBSERVE\`,
  \`bizStep: retail_selling\`, \`disposition: retail_sold\`.
- **Asynchronous** — \`202\` then poll, despite both source documents describing a synchronous \`200\`.
- Pharmacy or branch only: a manufacturer token gets \`403\`, and the body helpfully names the
  permitted roles (\`"available to: Pharmacy, SCP branch, SCP, Daf admin, B2B user, pharmacy_admin"\`).
- On success \`pack.status\` becomes \`dispensed\`.`,
    gotchas: `- **27 of the manufacturer's 30 products cannot be dispensed here.** They carry
  \`isDawanaIntegration: true\` and the platform refuses: *"Dispensing is not allowed for
  Dawana-integrated products via this channel."* Use \`MFG_DISPENSABLE_GTINS\` — only
  \`08435308348882\`, \`08435308348912\`, \`08435308348929\` work. A test that picks a GTIN at random
  fails for the wrong reason.
- A dispensing test needs the **whole chain** first (commission → pack → ship → receive at branch →
  ship → receive at pharmacy). \`eptts-api-supply-chain\` builds exactly that.
- Re-dispensing is refused with a precise, assertable message:
  \`"Invalid status transition for <epc>: 'dispensed' → 'dispensed'"\`.`,
  },
  'api-partial-dispensing': {
    why: `The only quantity-bearing event in the module. A pack sits in a partially-dispensed state across several requests until exhausted, so arithmetic correctness — and refusing to over-dispense — is the entire point of the feature.`,
    specifics: `- Same as dispensing plus a \`quantity\` field on the event.
- Sequential partial dispenses must decrement the remainder correctly and flip the pack to fully
  dispensed on the last one.`,
    gotchas: `- **BLOCKED: this feature cannot be executed on devsim at all.** Every one of the 30 registered
  products has \`dispenseType: "full"\`; none supports partial dispensing, so the platform has nothing
  to partially dispense. This is a test-data gap, not a code defect — see the filed bug. To unblock,
  register a product with a partial/unit \`dispenseType\` (Registry → Products) and ideally
  \`isDawanaIntegration: false\`.
- When it is unblocked, the cases that matter most are the boundaries: quantity exceeding the
  remainder must be **refused, not clamped**; zero, negative and fractional quantities; and
  concurrent partial dispenses of the same SGTIN, where the remainder must not go negative.`,
  },
}

const DASH = {
  'web-information-center': {
    why: `The only page every role can reach, which makes it the platform's de-facto fallback route. That matters for testing beyond its own content: when navigation fails, this is where the user lands, so "ended up on Information Center" is a signal that something else broke.`,
    gotchas: `- Read-only for all roles; there is no state to corrupt, which makes this a safe smoke target.
- Announcements were empty in devsim at discovery time, so an empty state is normal here and is not
  evidence of a fault.`,
  },
  'web-command-center': {
    why: `The national operations overview, and the first page a regulator looks at. Wrong numbers here are worse than a broken page, because a broken page is obvious and a wrong number is believed. Every figure traces back to EPCIS events, so a discrepancy is either an aggregation bug or a real traceability gap — both worth chasing.`,
    gotchas: `- Cross-check the headline figures against the API rather than trusting the page: \`reports/dashboard-kpi\`
  returned \`active: 1,683,142\`, \`dispensed: 24,002\`, \`in_transit: 5\`, \`total_packs: 1,707,149\` at
  discovery. A UI/API mismatch is the defect worth finding here.
- \`total_products: 6\` in the KPI payload while the registry holds far more — investigate what that
  figure actually counts before reporting it as wrong.`,
  },
  'web-reporting': {
    why: `Partners reconcile their own records against this page's CSV export, so column fidelity and filter correctness matter as much as the on-screen totals. An export that silently drops a filter is worse than one that fails.`,
    gotchas: `- Always verify the export **against the filtered on-screen rows**, not just that a file downloads.
- Date-range presets (Last 7/30/90 days, Last year) plus search plus pagination interact; test the
  combination, since each alone is trivially correct.`,
  },
  'web-analytics': {
    why: `Four views over the same traceability data. **Expiry risk** is the commercially significant one — it drives write-off decisions, so a wrong expiry-risk figure has direct financial consequence.`,
    gotchas: `- Tabs (Activity, Inventory, Shipments, Expiry risk) each load their own endpoint; assert a tab does
  not display the previous tab's data.
- \`reports/expiry-risk?withinDays=90\` is parameterised — vary \`withinDays\` and confirm the result set
  actually changes.`,
  },
  'web-violations': {
    why: `Drives regulatory follow-up. A violation that fails to appear is a compliance failure, not a display bug, which is why the empty state deserves suspicion: at discovery every severity bucket read zero, and "no violations" and "violations not loading" look identical.`,
    gotchas: `- All buckets were 0 in devsim. Before accepting that, confirm \`reports/violations\` really returns an
  empty set rather than failing silently.`,
  },
  'web-audit-console': {
    why: `The evidence record. It must be complete, immutable and attributable — those three properties are the feature. It also ships a **"What is not recorded?"** disclosure, which is itself a testable claim: verify the disclosure matches what the system actually omits.`,
    gotchas: `- Four tabs: Regulatory events, EDA submissions, Master-data changes, Integrity.
- \`audit/regulatory\` returns real entries with \`auditKey\`, \`eventType\`, \`severity\`, \`entityGln\`,
  \`userId\`. Cross-check that an action taken through the API appears here — a missing audit entry is
  the highest-value defect this page can surface.
- Immutability matters: confirm no UI path edits or deletes an audit row.`,
  },
  'web-master-data': {
    why: `How integrators obtain the signed master-data manifest. Files are SHA-256 stamped and the manifest is HMAC-signed, so integrity verification is part of the published contract rather than an optional extra — which makes signature and hash correctness in scope for testing, not just presence.`,
    gotchas: `- **Two filed defects live on this page.** It raises *"Cannot GET this resource"* on load with all
  tiles empty, and its sidebar group renders no child item so the page is unreachable by clicking.
- Master data is served by **registry-service** (\`/master-data/versions\`);
  \`masar-service/master-data/snapshot/latest\` is a 404. The page may be calling the wrong service.
- "Generate Now" writes a real snapshot — treat as a write action, not a read.`,
  },
  'web-settings-admin': {
    why: `The highest-privilege page in the product: 15 tabs covering every partner type, pharmacy admins, POS partners, B2B partners, platform staff, user locks and system configuration. Anything reachable here can change how the whole platform behaves, so role isolation is the dominant concern.`,
    gotchas: `- **Unreachable from the navigation** — no sidebar entry in any role. Filed.
- **Admin password reset is broken** (\`503\`, Keycloak update fails). Filed, and it blocks dashboard
  testing as the distributor and pharmacy roles entirely.
- 15 tabs is a large surface; treat each as its own sub-area rather than one page.
- Test role isolation by **direct URL** as a non-admin. Hiding a menu entry is not access control —
  and here there is no menu entry even for admin, so the URL is the only route in.`,
  },
  'web-products': {
    why: `The platform's own view of the registered catalogue. Useful mainly as a cross-check against the Registry portal's Products page and the API — three views of one dataset that must agree.`,
    gotchas: `- Also unreachable from the navigation (filed).
- Compare against \`registry-service/products\`: exactly one record has \`gtin\` and \`name\` transposed
  in the API while the Registry UI renders it correctly, so disagreement between views is a live
  possibility here.`,
  },
  'registry-dashboard': {
    why: `Landing view of the Registry portal; opens straight onto the Parties register, so it shares that feature's substance.`,
    gotchas: `- A separate SPA on \`:8446\`'s sibling port \`:8445\` with its own navigation idiom (emoji-prefixed
  buttons, not anchors), so selectors from the main dashboard do not transfer.`,
  },
  'registry-parties': {
    why: `The authoritative trade-party register, and **the only place B2B API keys are issued**. That makes it the gateway to all API testing: no key, no API coverage. It is also where GCP length is set, which determines how every SGTIN and SSCC for that partner is parsed.`,
    gotchas: `- **The "B2B Key" action is destructive.** Its tooltip is "Generate / rotate B2B API key" and the
  platform *cannot display an existing key* — only replace it (\`generate-key\` 409s if one exists;
  \`regenerate-key\` supersedes it). Rotating breaks whatever currently uses that key. Never click it
  casually on a party that is not yours.
- Endpoints behind the row actions: \`POST /b2b/partner/generate-key\`,
  \`POST /b2b/partner/regenerate-key\`, \`POST /admin/b2b-partners/by-gln/{gln}/regenerate-key\`.
- 50+ parties, paginated by cursor — a party absent from page 1 is not absent from the registry.
- Role vocabulary: entity type \`branch\` exists (8 of them) but there are **zero \`branch\`-role
  users**; branch behaviour is carried by the \`distributor\` role.`,
  },
  'registry-prefixes': {
    why: `GCP length here decides how every EPC for that partner is decoded. A wrong prefix does not fail loudly — it silently mis-parses SGTINs and SSCCs across the whole platform, which makes this small page disproportionately important.`,
    gotchas: `- Cross-check a prefix against a real EPC: GTIN \`08435308354487\` with GCP length 8 must yield
  \`urn:epc:id:sgtin:84353083.05448.<serial>\`. If the prefix is wrong the URN is wrong and
  commissioning fails with a confusing error far from the cause.`,
  },
  'registry-products': {
    why: `Two fields on this page directly control API behaviour, which makes it a test-data control panel as much as a catalogue: \`dispenseType\` decides whether partial dispensing is possible at all, and the Dawana flag decides whether a product can be dispensed through the B2B API.`,
    gotchas: `- **Both API dispensing blockers originate here.** All 30 devsim products are \`dispenseType: "full"\`
  (so partial dispensing is untestable) and 27 of 30 are Dawana-integrated (so undispensable via the
  API). Fixing the test-data gap means adding a product here.
- One record has \`gtin\` and \`name\` transposed in the API response while this page renders it
  correctly — filed. The GTIN field accepts non-numeric text, which is the underlying issue.
- Columns: GTIN, NAME, MANUFACTURER, MAH GLN, UNIT PRICE, DISPENSE, DAWANA, STATUS, SYNCED, ACTIONS.`,
  },
  'registry-register-pharmacy': {
    why: `The widest input surface in the product — 25 fields — which makes it the highest-value target for mandatory-field and format-validation testing, and the place where a validation gap is most likely to let bad master data in.`,
    gotchas: `- Creating a pharmacy is a **write to the production registry**. Prefer validation-failure cases,
  which exercise the form without persisting anything.
- GLN check-digit validation is the highest-value single check: a pharmacy with an invalid GLN
  corrupts every downstream event addressed to it.`,
  },
  'billing-dashboard': {
    why: `Entry point to the billing portal; loads a MAH's outstanding dues by GLN, so it is a thin wrapper over the Unbilled Operations data.`,
    gotchas: `- Requires a MAH GLN as input — there is no default view, so an empty page is expected until one is
  supplied.`,
  },
  'billing-unbilled-operations': {
    why: `The input to invoice generation. An operation missing from this list never gets invoiced, so an omission here is lost revenue rather than a display fault.`,
    gotchas: `- Reconcile against the packing operations the API actually recorded for that MAH; the two must
  agree. That cross-check is the real test.`,
  },
  'billing-invoices': {
    why: `Financial records. Arithmetic correctness and immutability after payment are the whole feature — a recalculated paid invoice is a far more serious defect than a rendering fault.`,
    gotchas: `- Columns: INVOICE #, MAH GLN, PIECES, BILLING CHARGE, ESERVICE, TOTAL, STATUS, CREATED, PAID.
- Verify \`subtotal + fees = total\` independently rather than trusting the displayed total, and that
  \`sgtinCount\` matches the pieces billed.
- Confirm a \`PAID\` invoice cannot be edited or re-totalled.`,
  },
  'billing-reports': {
    why: `Revenue reporting across MAHs and periods; the figures partners and finance both rely on, so period-boundary correctness is the main risk.`,
    gotchas: `- 15 inputs, mostly period and scope filters. Boundary dates are where reporting bugs live — test the
  first and last day of a period explicitly.`,
  },
  'billing-configuration': {
    why: `The price-band table decides what every partner is charged. Changing a band changes real invoices, which makes this both high-impact and a write surface to be careful with.`,
    gotchas: `- **Band edges are the critical cases**: a price exactly equal to a band's \`from\` or \`to\` must fall in
  exactly one band. Off-by-one here mis-bills every partner at that price point.
- Verify overlapping and gapped bands are rejected.
- Editing a band is a **production write** affecting billing — prefer read and validation cases.`,
  },
}

// ─── render ──────────────────────────────────────────────────────────────────

const BUGS_BY_FEATURE = bugsByFeature()

function render(slug, isApi) {
  const meta = (isApi ? API : DASH)[slug]
  if (!meta) return null

  const L = []
  L.push(`# ${slug} — Feature Knowledge`, '')
  L.push('## Why this feature matters', '', meta.why, '')

  if (meta.specifics) L.push('## Contract specifics', '', meta.specifics, '')

  const xhr = isApi ? [] : observedXhr(slug)
  if (xhr.length) {
    L.push('## Endpoints this page depends on', '')
    L.push('Captured from the browser during discovery, so this is what the page really calls:', '')
    L.push('```')
    for (const c of xhr.slice(0, 12)) L.push(c)
    L.push('```', '')
    L.push('A failure in any of these surfaces here, so check the endpoint directly before concluding the', 'page is at fault.', '')
  }

  if (meta.gotchas) L.push('## What will bite you', '', meta.gotchas, '')

  const bugs = BUGS_BY_FEATURE[slug] || []
  if (bugs.length) {
    L.push('## Known defects filed against this feature', '')
    for (const b of bugs) L.push(`- **${b.priority}** — ${b.title}`)
    L.push('', 'All are `draft` status: filed in-repo, not yet raised in Jira.', '')
  }

  if (isApi) L.push(ASYNC_CONTEXT, '', ERROR_SHAPES, '')
  L.push(CROSS_CUTTING, '')
  // Keep the blank lines between sections: markdown needs one before a heading.
  return L.join('\n').replace(/\n{3,}/g, '\n\n') + '\n'
}

const all = fs.readdirSync(FEATURES).filter((f) => fs.existsSync(path.join(FEATURES, f, 'workflow.md')))
let written = 0
const missing = []

for (const slug of all) {
  const isApi = slug.startsWith('api-')
  const md = render(slug, isApi)
  if (!md) { missing.push(slug); continue }
  if (WRITE) fs.writeFileSync(path.join(FEATURES, slug, 'knowledge.md'), md, 'utf8')
  written++
  console.log(`  ${slug.padEnd(30)} ${String(md.split('\n').length).padStart(4)} lines  ${(BUGS_BY_FEATURE[slug] || []).length} bug(s)`)
}

console.log(`\n${WRITE ? 'wrote' : 'would write'} ${written} knowledge.md of ${all.length} features`)
if (missing.length) {
  console.error(`\n!! no knowledge authored for: ${missing.join(', ')}`)
  process.exitCode = 1
}
if (!WRITE) console.log('(pass --write to apply)')
