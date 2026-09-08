---
title: >-
  [Returns] A branch cannot pass on a pack a pharmacy returned — the source
  check names the pharmacy while VerifyProduct reports the branch as custodian
status: draft
jira_key: null
reported_at: null
feature: api-return
priority: P1 – Critical
bug_type: Functional (Backend/API)
parent_key: null
severity: ''
layer: unknown
jira_status: ''
jira_reporter: ''
found_by: Claude (automated API suite)
found_at: '2026-09-08T10:20:00.000Z'
environment: Production (devsim)
---
The reverse chain breaks at its second hop. A pharmacy returns a pack to its branch, the branch
confirms the return and takes custody, and the branch then cannot return that pack onward to the
manufacturer: the event is refused with `Source GLN 6220000000013 (Test Pharmacy 1) is a pharmacy,
but must be a branch or distributor or manufacturer for this type of return.` That GLN appears
nowhere in the submitted document — its sourceList, readPoint and SBDH sender are all the branch —
and `VerifyProduct` reports the same packs as held by the branch. The handler is validating the
event against the earlier return's record rather than the document it was given, so returned stock
reaches a branch and can never leave it, and the traceability record cannot show the pack getting
back to the manufacturer that made it.

**Covers test cases:** `E2E-12`

---

**Steps to Reproduce:**

1. Connect the Citrix VPN and authenticate the manufacturer, distributor and pharmacy at
   `POST :8445/registry-service/api/v1/auth` with each `apikey`.
2. Commission two SGTINs of an approved, non-Dawana product, aggregate them into one SSCC, ship
   manufacturer → branch and have the branch receive it.
3. Ship branch → pharmacy and have the pharmacy receive it, then unpack the SSCC at the pharmacy.
4. As the pharmacy, return-ship both packs to the branch: `ObjectEvent`, `bizStep: shipping`,
   `disposition: returned`, `sourceList` the pharmacy SGLN, `destinationList` the branch SGLN, with
   a return reference in `bizTransactionList`.
5. As the branch, confirm the return: `bizStep: receiving`, `disposition: returned`, quoting that
   same return reference. It succeeds.
6. `POST :8444/masar-service/api/v1/VerifyProduct` for each pack as the branch and note
   `currentGln` is the branch, `5413868000108`.
7. As the branch, return-ship both packs to the manufacturer with a NEW return reference:
   `sourceList` the branch SGLN, `destinationList` the manufacturer SGLN, SBDH sender the branch.
   Poll `MsgStatusQuery`.

---

**Expected Result:**
The branch returns the packs on to the manufacturer, exactly as it can for a pack it received
by an ordinary shipment rather than by a return.

---

**Actual Result:**
`E - Application Error` — `Return event failed: Source GLN 6220000000013 (Test Pharmacy 1) is a
pharmacy, but must be a branch or distributor or manufacturer for this type of return.`, naming a
GLN that is not in the submitted document.

---

**Environment:**
Masar B2B API on devsim over the Citrix VPN
POST https://192.168.225.195:8444/masar-service/api/v1/scp/SendEPCIS
Auth at https://192.168.225.195:8445/registry-service/api/v1/auth
Tenant: manufacturer GLN 5413868000009, distributor GLN 5413868000108, pharmacy GLN 6220000000013
Product 05413868110449 — approved price, isDawanaIntegration false, dispenseType full
Self-signed TLS; certificate validation disabled for the run

---

**Priority:**
P1 – Critical

---

**Bug Type:**
Functional (Backend/API)
