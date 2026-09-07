---
title: >-
  [Dispensing] No dispense document can be valid — the readPoint must be the
  sender's own GLN, and the sender's own GLN is rejected as not permitted
status: draft
jira_key: null
reported_at: null
feature: api-dispensing
priority: P1 – Critical
bug_type: Functional (Backend/API)
parent_key: null
severity: ''
layer: unknown
jira_status: ''
jira_reporter: ''
found_by: Claude (automated API suite)
found_at: '2026-09-07T18:40:00.000Z'
environment: ngrok relay
---
Dispensing is unreachable for the pharmacy B2B partner on this tenant, because two ownership rules contradict each other. A dispense whose `readPoint` is any GLN other than the sender's is refused with `Ownership violation: readPoint GLN 6225000935525 does not belong to the sender 6224010005150. You can only act under your own GLN.` A dispense whose `readPoint` IS the sender's own GLN `6224010005150` is refused with `Dispense events must be scoped to the caller's permitted GLNs.` So the caller's own GLN is simultaneously the only GLN it may act under and not a GLN it is permitted to use, and no document can satisfy both. Confirmed identical on `/Dispensation` and `/scp/SendEPCIS`, with the SBDH receiver set to the supplying distributor, to the pharmacy itself and to its parent `pharmacy_admin` — neither the endpoint nor the receiver is the variable.

THE ENDPOINT IS NOT THE CAUSE, tested directly on 2026-09-07. The suggestion was that the legacy `/Dispensation` route resolves the acting identity as the parent `pharmacy_admin` while the unified `/scp/SendEPCIS` trusts the JWT, so re-pointing the dispense would fix it. It does not: with a pack legitimately at the pharmacy and an unchanged body — sender, readPoint and bizLocation all the pharmacy's own GLN — both endpoints answer `202` and both settle on `Dispense events must be scoped to the caller's permitted GLNs`. `/Dispensation` also no longer answers `200` synchronously; it returns the same accepted-for-processing envelope and settles through MsgStatusQuery, so dispensing is indeed asynchronous now and the legacy path behaves as an alias. The pack is left untouched either way (`currentGln` the pharmacy, `status` active). Stock can therefore be commissioned, packed, shipped and received all the way to the pharmacy shelf and then never leave it, so the traceability record cannot record the one event that ends a pack's life legitimately.

ORDER OF VALIDATION MATTERS WHEN REPRODUCING THIS. Custody is checked BEFORE the permitted-GLN rule, so if the pack is not already at the pharmacy the own-GLN document is refused with `Cannot dispense: 1 pack(s) are not at pharmacy 6224010005150. Found at: <holder>` and the GLN rule is never reached. A shortened reproduction that skips the six-step chain therefore looks as though acting under your own GLN is accepted. The contradiction only surfaces once custody legitimately succeeds.

**Covers test cases:** `TC_DISP_001`, `TC_DISP_003`, `TC_DISP_010`, `TC_DISP_030`, `TC_DISP_035`, `TC_DISP_036`

---

**Steps to Reproduce:**

1. Connect the Citrix VPN.
2. Authenticate as the manufacturer at POST https://4430-41-129-1-185.ngrok-free.app/masar-service/api/v1/auth with header apikey: <manufacturer key>.
3. Commission an SGTIN of 05413868110456, pack it into a fresh SSCC, ship it to the distributor 0847976000005, receive it, ship it to the pharmacy 6224010005150 and receive it. All six succeed. Do not shorten this — see the note above about validation order.
4. Authenticate as the pharmacy with header apikey: <pharmacy key> and confirm POST /VerifyProduct reports the pack as status active, currentGln 6224010005150.
5. POST a dispensing ObjectEvent (bizStep retail_selling, disposition retail_sold, one EPC) to /Dispensation with readPoint and bizLocation set to urn:epc:id:sgln:6224010.00515.0 — the pharmacy's own SGLN — and poll MsgStatusQuery.
6. Repeat step 5 with readPoint and bizLocation set to the parent pharmacy_admin GLN 6225000935525, and poll MsgStatusQuery.
7. Repeat step 5 against /scp/SendEPCIS instead of /Dispensation, and with the SBDH receiver set to 6224010005150 and to 6225000935525 in turn.

---

**Expected Result:**
A pharmacy that holds a pack can dispense it under its own GLN, and exactly one of the two rules applies to any given document.

---

**Actual Result:**
Every document is refused: acting under the sender's own GLN gives `Dispensing event failed: Dispense events must be scoped to the caller's permitted GLNs.` and acting under any other GLN gives `Dispensing event failed: Ownership violation: readPoint GLN 6225000935525 does not belong to the sender 6224010005150. You can only act under your own GLN.`

---

**Environment:**
Masar B2B API over the ngrok relay
POST https://3e21-41-129-1-185.ngrok-free.app/masar-service/api/v1/Dispensation
POST https://3e21-41-129-1-185.ngrok-free.app/masar-service/api/v1/scp/SendEPCIS
Auth at https://4430-41-129-1-185.ngrok-free.app/masar-service/api/v1/auth
Tenant: Janssen, manufacturer GLN 5413868000009, distributor GLN 0847976000005
Acting role: pharmacy, GLN 6224010005150 (PH Sydy Bishr esaaf 24, isMainBranch false, parent EPCT Pharmacies Admin GLN 6225000935525)
Product 05413868110456 reads isDawanaIntegration false, dispenseType full, isActive true from GET /products
Self-signed TLS upstream of the tunnel; certificate validation disabled for the run

---

**Priority:**
P1 – Critical

---

**Bug Type:**
Functional (Backend/API)
