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

The second submission is *not* an exact byte-for-byte replay: each carries a fresh
`instanceIdentifier`, since the platform rejects a reused one. So the message-level replay
guard works; what is missing is the **event-level** check that the requested state change has
already been made. Packing packs that are already in that container, or unpacking packs that
are already out of it, are both no-ops being reported as successful work.

Why it matters, and why it is P2 rather than P1: it does not by itself corrupt the current
state — the pack ends up where it would have anyway. The damage is to the event history, which
is the actual product here. A duplicate aggregation event makes it look as though the container
was built twice, and any count or reconciliation derived by replaying events (rather than
reading current state) will double-count. In a system whose purpose is an auditable chain of
custody, a trace containing events that never physically happened is a real defect.

It is also the shape of a retry bug in a partner integration: a client that resends after a
timeout has no way to discover its first attempt succeeded, and the platform will happily
record the work twice.

Related, already filed for commissioning: *"An already-commissioned SGTIN can be
re-commissioned, and re-commissioning with a different expiry is accepted"* (`TC_COMM_003`,
`TC_COMM_012`). That is the same missing already-in-this-state check on a third feature, which
suggests the guard is absent generally rather than in the aggregation handler specifically.
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
1. The second submission is refused — the packs are already in (or already out of) that
   container, so there is no state change to make.
---
**Actual Result:**
1. The second submission is accepted, `messagestatus: "S - Successful"`, `logList` reporting
   the event processed successfully.
2. The event history now contains a packing (or unpacking) event that describes work the
   platform did not actually do.
---
**Environment:** Masar Platform · `:8444/masar-service/api/v1` · tenant devsim · via Citrix VPN

**Evidence:** `api-log.html` for `eptts-api-packing-ts_pack_016` and
`eptts-api-unpacking-ts_unpk_011` — each shows both submissions and both successful polls.
