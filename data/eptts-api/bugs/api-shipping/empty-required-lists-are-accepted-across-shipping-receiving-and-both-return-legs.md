---
title: >-
  [Validation] Empty required lists (sourceList, destinationList,
  bizTransactionList, epcList) are accepted and processed successfully across
  shipping, receiving and both return legs
status: draft
jira_key: null
reported_at: null
feature: api-shipping
priority: P1 – Critical
bug_type: Functional (Backend/API)
parent_key: null
severity: ''
layer: unknown
jira_status: ''
jira_reporter: ''
found_by: Ziad Yehia
found_at: '2026-09-01T01:10:00.000Z'
---
An EPCIS event whose required list is present but **empty** is accepted and reported
`S - Successful`. It is not rejected synchronously, and `MsgStatusQuery` reports the message
and every event inside it as processed.

**Covers test cases:** `TC_SHIP_007`, `TC_SHIP_021`, `TS_RECV_007`, `TS_RTRV_006`, `TS_RTN_007`, `TS_RTN_009`, `TS_RTN_025`

**Re-scoped 2026-09-08.** `TS_RTRV_010` and `TC_DEST_005` are withdrawn: return receiving and
destruction now refuse an empty `epcList` correctly. The seven remaining cases still accept an
empty `sourceList`, `destinationList` or `bizTransactionList` on devsim.

---

**Steps to Reproduce:**

1. Connect the Citrix VPN and authenticate as the manufacturer against
   `POST :8445/registry-service/api/v1/auth`.
2. Build a valid shipping EPCIS document for a commissioned, packed SSCC.
3. Set `sourceList` to `[]`, leaving every other field valid.
4. `POST` it to `:8444/masar-service/api/v1/scp/SendEPCIS`.
5. Poll `POST /MsgStatusQuery` with the document's `instanceIdentifier` until it reaches a
   terminal state.
6. Repeat for `bizTransactionList`, and for the receiving and return documents.

---

**Expected Result:**
The submission is refused — synchronously with `400`, or asynchronously with `messagestatus` starting `E` and a `logList` entry naming the empty field.

---

**Actual Result:**
The submission is accepted (`202` / `I001`); `MsgStatusQuery` reports `messagestatus: "S - Successful"` with `logList: [I: <event> processed successfully, I: Message processed successfully — all 1 event(s) completed]`; the event is committed to the trace with no counterparty / no invoice / no packs.

---

**Environment:**
Masar Platform
`:8444/masar-service/api/v1`
tenant devsim
via Citrix VPN

---

**Priority:**
P1 – Critical

---

**Bug Type:**
Functional (Backend/API)
