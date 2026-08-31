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

Confirmed on 8 cases across 4 features in a single clean run (no infrastructure failures):

| Case | Feature | Empty list |
|---|---|---|
| `TC_SHIP_007` | Shipping | `sourceList` |
| `TC_SHIP_021` | Shipping | `bizTransactionList` |
| `TS_RECV_007` | Receiving | `sourceList` |
| `TS_RTRV_006` | Return Receiving | `sourceList` |
| `TS_RTRV_010` | Return Receiving | `epcList` |
| `TS_RTN_007` | Return Shipping | `sourceList` |
| `TS_RTN_009` | Return Shipping | `destinationList` |
| `TS_RTN_025` | Return Shipping | `bizTransactionList` |

**This is one defect, not eight.** The same input class is accepted on four different
features and four different list fields, which puts it in the shared EPCIS event validator
rather than in any one handler. There is an existing Commissioning ticket for the `epcList`
case; that ticket understates the scope — the gap is platform-wide, and fixing it only in the
commissioning handler would leave the other seven.

**Why it is P1 rather than a validation nicety.** These lists are what make an event *mean*
something:

- an empty `sourceList` or `destinationList` records a custody transfer with no counterparty,
  so the trace says stock moved but not from or to whom;
- an empty `bizTransactionList` records a shipment with no invoice, and the invoice number is
  the platform's own key for a shipment (it enforces uniqueness on it elsewhere);
- an empty `epcList` records an event that touched no packs at all.

Each produces a record that looks valid, reports success, and is unusable for traceability —
which is the one thing this system exists to provide. A silent accept is worse than a reject
here, because nothing downstream ever learns the data is meaningless.
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
1. The submission is refused — synchronously with `400`, or asynchronously with
   `messagestatus` starting `E` and a `logList` entry naming the empty field.
---
**Actual Result:**
1. The submission is accepted (`202` / `I001`).
2. `MsgStatusQuery` reports `messagestatus: "S - Successful"` with
   `logList: [I: <event> processed successfully, I: Message processed successfully — all 1
   event(s) completed]`.
3. The event is committed to the trace with no counterparty / no invoice / no packs.
---
**Environment:** Masar Platform · `:8444/masar-service/api/v1` · tenant devsim · via Citrix VPN

**Evidence:** each case's `api-log.html` from the Automation Hub run records the exact request
body and the poll responses. Reproduce any single case by replaying its project, e.g.
`eptts-api-shipping-tc_ship_007`.

---
**The validator is inconsistent per endpoint, which narrows the fix.**

Shipping DOES reject an empty `epcList` — `TC_SHIP_020` returns
`E - Application Error` with `logList: [E: Shipping event failed: Shipping event epcList
contains no SGTINs or SSCCs]`. Return Receiving accepts the same empty `epcList`
(`TS_RTRV_010`), and shipping still accepts an empty `sourceList` and `bizTransactionList`.

So the platform already contains a correct implementation of exactly this check; it is simply
not applied uniformly across event types and list fields. That makes this more likely to be a
missing call than missing logic, and it gives a working reference to copy.
