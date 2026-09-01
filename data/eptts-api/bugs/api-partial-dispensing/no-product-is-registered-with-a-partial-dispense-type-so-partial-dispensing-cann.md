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

**Covers test cases:** `TC_PDISP_001`, `TC_PDISP_002`, `TC_PDISP_003`, `TC_PDISP_004`, `TC_PDISP_010`, `TC_PDISP_011`, `TC_PDISP_013`, `TC_PDISP_017`, `TC_PDISP_018`, `TC_PDISP_019`, `TC_PDISP_020`, `TC_PDISP_021`, `TC_PDISP_022`

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
At least one partial-dispense product is actionable by the manufacturer we hold credentials for, so a partial pack can be commissioned, shipped, received and partially dispensed end to end.

---

**Actual Result:**
Five partial products exist; none has `mahGln: "8435308300002"`; commissioning one of them is refused: `messagestatus` `"E - Application Error"` with *"Commission authorization failed … Only the marketing-authorisation holder or its registered agent may act for a product."*; with no partial pack obtainable, 13 partial-dispensing cases remain unexecutable.

---

**Environment:**
Masar B2B API via Citrix VPN
Auth: `POST https://192.168.225.195:8445/registry-service/api/v1/auth` (apikey header)
Events: `POST https://192.168.225.195:8444/masar-service/api/v1/scp/SendEPCIS`
Registry: `GET https://192.168.225.195:8445/registry-service/api/v1/products`
Tenant devsim, manufacturer INSTITUTO GRIFOLS, GLN 8435308300002
TLS: self-signed certificate

---

**Priority:**
P2 – High

---

**Bug Type:**
Functional
