---
title: >-
  [Validation] An identical packing or unpacking request submitted twice is
  accepted both times — no idempotency or replay protection
status: draft
jira_key: null
reported_at: null
feature: api-packing
priority: P2 – High
bug_type: Functional (Backend/API)
parent_key: null
severity: ''
layer: unknown
jira_status: ''
jira_reporter: ''
found_by: Ziad Yehia
found_at: '2026-09-01T01:25:00.000Z'
---
Submitting the same aggregation or disaggregation twice succeeds twice. Confirmed on
`TS_PACK_016` (pack the same children into the same SSCC again) and `TS_UNPK_011` (unpack the
same children from the same SSCC again) — both report `S - Successful` on the second attempt.

**Covers test cases:** `TS_PACK_016`, `TS_UNPK_011`

---

**Steps to Reproduce:**

1. Connect the Citrix VPN and authenticate as the manufacturer.
2. Commission a pack and aggregate it into a fresh SSCC. Poll to `S - Successful`.
3. Submit the identical aggregation again with a new `instanceIdentifier` and nothing else
   changed.
4. Poll `MsgStatusQuery` to a terminal state.
5. Repeat the pair for unpacking: disaggregate, then disaggregate again.
6. Read the pack with `POST /VerifyProduct` and inspect `pack.parentSscc`, then list the
   events for that pack.

---

**Expected Result:**
The second submission is refused — the packs are already in (or already out of) that container, so there is no state change to make.

---

**Actual Result:**
The second submission is accepted, `messagestatus: "S - Successful"`, `logList` reporting the event processed successfully; the event history now contains a packing (or unpacking) event that describes work the platform did not actually do.

---

**Environment:**
Masar Platform
`:8444/masar-service/api/v1`
tenant devsim
via Citrix VPN

---

**Priority:**
P2 – High

---

**Bug Type:**
Functional (Backend/API)
