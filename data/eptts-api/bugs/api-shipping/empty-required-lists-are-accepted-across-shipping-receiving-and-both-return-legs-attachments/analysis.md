# Background for empty-required-lists-are-accepted-across-shipping-receiving-and-both-return-legs

Moved out of the bug body to keep the report to the point. Not an attachment the platform indexes (only images and video are), just a file kept beside it.

Confirmed on 9 cases across 5 features in a single clean run (no infrastructure failures):

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

**Exchange evidence:** `1-exchange-tc_ship_007.jpg`, `2-exchange-tc_ship_021.jpg`, `3-exchange-ts_recv_007.jpg` — the exact request, the response, and the platform's verdict from `MsgStatusQuery`. Replayable copies (`api-log.html`, `api-postman-collection.json`) are written beside each run under `automation-hub/projects/<project>/runs/`. The same shape repeats for `TS_RTRV_006`, `TS_RTRV_010`, `TS_RTN_007`, `TS_RTN_009`, `TS_RTN_025`, `TC_DEST_005`.

**Covers test cases:** `TC_SHIP_007`, `TC_SHIP_021`, `TS_RECV_007`, `TS_RTRV_006`, `TS_RTRV_010`, `TS_RTN_007`, `TS_RTN_009`, `TS_RTN_025`, `TC_DEST_005`
