---
title: >-
  [BLOCKER][Partial Dispensing] Five partial-dispense products exist, but none is
  held by the manufacturer whose API key we have, so no partial pack can be commissioned
status: draft
jira_key: null
reported_at: null
feature: api-partial-dispensing
priority: P2 – High
bug_type: Functional
parent_key: null
severity: ''
layer: unknown
jira_status: ''
jira_reporter: ''
found_by: Ziad Yehia
found_at: '2026-08-31T10:05:00.000Z'
---
**Correction to the earlier version of this report.** It said no product on the platform was
registered for partial dispensing. That was wrong — it was measured against the devsim
manufacturer's own 30-product catalogue, not the whole registry. The registry holds **662
products, of which 5 are `dispenseType: "partial"`**, including `07910000000012`
"LoadTest Product 0". The blocker is real, but the reason is different and it changes what
unblocks it.

| GTIN | Name | MAH GLN | Dawana | Active |
|---|---|---|---|---|
| `07910000000012` | LoadTest Product 0 | 8002660000071 | **yes** | yes |
| `06290009990011` | Targ 80 | 6290009990004 | no | yes |
| `05413868123456` | testagent | 5413868000009 | no | yes |
| *(2 further partial products)* | — | 8002660000071 / others | 1 yes | — |

**None is held by GLN 8435308300002**, the manufacturer whose API key this suite
authenticates with — and the platform correctly refuses to let one MAH act for another's
product. Commissioning `06290009990011` (the most promising candidate: partial, non-Dawana,
active) is rejected with:

> Commission GTIN-ownership: Commission authorization failed. GTIN 06290009990011 is
> registered to 6290009990004 with no registered agent, and this request was sent by
> 8435308300002. Only the marketing-authorisation holder or its registered agent may act for
> a product. If 8435308300002 does act for this product, add it as the `registeredAgentGln`
> on the product in the registry and retry.

**That refusal is correct behaviour, not a defect.** A manufacturer minting serial numbers
against another company's GTIN is precisely what MAH ownership exists to prevent. The message
is exemplary: it names both GLNs, the rule, and the remedy.

So the chain cannot even begin. Partial dispensing needs a commissioned pack of a partial
product; we cannot commission one; therefore the **13 remaining partial-dispensing cases**
cannot be exercised. (The envelope and field negatives in this feature do not depend on
`dispenseType` and already run.)

A second constraint would bite even if ownership were solved for the wrong candidate: 2 of the
5 partial products — including LoadTest Product 0 — are `isDawanaIntegration: true`, and this
channel refuses those outright: *"Dispensing is not allowed for Dawana-integrated products via
this channel. These products must be dispensed through the Dawana integration."* Any fix
should therefore target one of the **non-Dawana** partial products.
---
**Steps to Reproduce:**
1. Connect the Citrix VPN.
2. Authenticate as the devsim manufacturer: `POST :8445/registry-service/api/v1/auth` with the
   `apikey` header (`EPTTS_MFG_APIKEY`).
3. List the registry with `GET :8445/registry-service/api/v1/products?limit=100&offset=0`,
   paging by `offset` until fewer than 100 items come back (662 in total). Note: a `page`
   parameter is ignored — it returns the first page every time.
4. Filter for `dispenseType === "partial"`; five products are returned, none with
   `mahGln: "8435308300002"`.
5. Build a commissioning EPCIS document for `06290009990011` with `gcpLength` 9 and submit it
   to `POST :8444/masar-service/api/v1/scp/SendEPCIS` as the manufacturer.
6. Poll `POST /MsgStatusQuery` with the document's `instanceIdentifier` until terminal.
---
**Expected Result:**
1. At least one partial-dispense product is actionable by the manufacturer we hold
   credentials for, so a partial pack can be commissioned, shipped, received and partially
   dispensed end to end.
---
**Actual Result:**
1. Five partial products exist; none has `mahGln: "8435308300002"`.
2. Commissioning one of them is refused: `messagestatus` `"E - Application Error"` with
   *"Commission authorization failed … Only the marketing-authorisation holder or its
   registered agent may act for a product."*
3. With no partial pack obtainable, 13 partial-dispensing cases remain unexecutable.
---
**Environment:**
- Masar B2B API via Citrix VPN
- Auth: `POST https://192.168.225.195:8445/registry-service/api/v1/auth` (apikey header)
- Events: `POST https://192.168.225.195:8444/masar-service/api/v1/scp/SendEPCIS`
- Registry: `GET https://192.168.225.195:8445/registry-service/api/v1/products`
- Tenant devsim, manufacturer INSTITUTO GRIFOLS, GLN 8435308300002
- TLS: self-signed certificate
---
**Priority:**
P2 – High
---
**Bug Type:**
Functional
---
**Notes:**
**Exchange evidence:** `1-exchange-commission-ownership-refusal.jpg` — the commissioning attempt and the platform’s ownership refusal, which is what blocks the 13 cases.

**Covers test cases:** `TC_PDISP_001`, `TC_PDISP_002`, `TC_PDISP_003`, `TC_PDISP_004`, `TC_PDISP_010`, `TC_PDISP_011`, `TC_PDISP_013`, `TC_PDISP_017`, `TC_PDISP_018`, `TC_PDISP_019`, `TC_PDISP_020`, `TC_PDISP_021`, `TC_PDISP_022`

This is a test-data / environment gap, not a code defect — no part of it should be fixed in
application code. Any one of these unblocks it:

1. Add `8435308300002` as the `registeredAgentGln` on `06290009990011` or `05413868123456`
   (both partial and non-Dawana). This is the remedy the platform's own error message
   proposes, and it is the smallest change.
2. Register a new partial, non-Dawana product under MAH `8435308300002`.
3. Supply the API key of a MAH that already holds a non-Dawana partial product
   (`6290009990004` or `5413868000009`).

Until then the 13 dependent cases stay `blocked` with this reason recorded, rather than being
reported as untested or quietly passing.
