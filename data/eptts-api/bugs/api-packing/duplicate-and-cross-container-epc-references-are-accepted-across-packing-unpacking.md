---
title: >-
  [Validation] A child is accepted under two parent SSCCs in one request, and
  unpacking accepts a child the SSCC does not contain
status: draft
jira_key: null
reported_at: null
feature: api-packing
priority: P1 – Critical
bug_type: Functional (Backend/API)
parent_key: null
severity: ''
layer: unknown
jira_status: ''
jira_reporter: ''
found_by: Ziad Yehia
found_at: '2026-09-01T01:15:00.000Z'
---
An event that names the same EPC twice, or names a pack that does not belong to the container
it references, is accepted and reported `S - Successful`.

**Covers test cases:** `TS_PACK_011`, `TS_UNPK_005`

**Re-scoped 2026-09-08.** The duplicate-EPC half of this report is withdrawn: the product owner
confirms a repeated EPC in one event is SKIPPED rather than refused, so `TS_PACK_009`,
`TC_DEST_008`, `TS_RECV_015` and `TS_RTN_021` are correct behaviour and now assert the repeat
leaves the pack unchanged. What remains is the cross-container half, which is a different
defect: a child accepted under two parents at once, and a child unpacked from a container that
never held it. Both still reproduce on devsim.

---

**Steps to Reproduce:**

1. Connect the Citrix VPN and authenticate as the manufacturer.
2. Commission two packs and pack them into an SSCC so a valid aggregation exists.
3. Build an `AggregationEvent` whose `childEPCs` names the same SGTIN twice; submit it to
   `:8444/masar-service/api/v1/scp/SendEPCIS`.
4. Poll `MsgStatusQuery` to a terminal state.
5. For `TS_PACK_011`, submit one document containing two `AggregationEvent`s that claim the
   same child under different `parentID` values.
6. Read the child back with `POST /VerifyProduct` and inspect `pack.parentSscc`.

---

**Expected Result:**
Each submission is refused, naming the duplicated EPC or the container mismatch; `pack.parentSscc` continues to reflect the one container the pack is actually in.

---

**Actual Result:**
Every one of the six is accepted: `messagestatus: "S - Successful"`, with the per-event `logList` reporting the event processed successfully; no error, no warning, and nothing downstream indicates the aggregation is inconsistent.

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
