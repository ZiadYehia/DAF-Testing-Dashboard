---
title: >-
  [Business rule] Custody destinations are not validated — a return goes to a
  party that never supplied the pack, and a shipment goes to an unregistered GLN
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
found_at: '2026-09-01T01:20:00.000Z'
---
Two custody rules that define who may hold stock are not enforced. Both were confirmed in a
clean run, and both are accepted with `messagestatus: "S - Successful"`.

**Covers test cases:** `TC_SHIP_036`, `TS_RTN_012`

---

**Steps to Reproduce:**

*TC_SHIP_036 — unregistered destination*
1. Connect the Citrix VPN and authenticate as the manufacturer.
2. Commission a pack and aggregate it into an SSCC.
3. Build a shipping `ObjectEvent` whose `destinationList` names an SGLN for a GLN that is not
   registered as a trade party.
4. `POST` to `:8444/masar-service/api/v1/scp/SendEPCIS` and poll `MsgStatusQuery`.

*TS_RTN_012 — return to a non-supplier*
1. Move a pack manufacturer → branch and have the branch receive it.
2. As the branch, build a return event whose receiver is a registered party that never
   supplied the pack (e.g. the pharmacy GLN rather than the manufacturer).
3. Submit and poll.

---

**Expected Result:**
The shipment is refused because the destination is not a registered party; the return is refused because the destination is not the party that supplied the pack.

---

**Actual Result:**
Both are accepted: `S - Successful`, with `logList` reporting the event processed successfully and the message completed; the trace records the transfer as valid.

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
