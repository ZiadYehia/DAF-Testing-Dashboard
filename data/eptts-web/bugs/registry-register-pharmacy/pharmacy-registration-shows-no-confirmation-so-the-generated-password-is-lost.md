---
title: >-
  [Registry] Registering a pharmacy shows no confirmation at all, so the
  auto-generated account password is never displayed and the account is unusable
status: draft
jira_key: null
reported_at: null
feature: registry-register-pharmacy
priority: P1 – Critical
bug_type: Functional
parent_key: null
severity: ''
layer: unknown
jira_status: ''
jira_reporter: ''
found_by: Ziad Yehia
found_at: '2026-09-09T00:37:00.000Z'
---
Submitting Register Pharmacy with **Generate login account** selected and the password field left blank creates the party and creates the account, but the page displays nothing whatsoever afterwards — no success panel, no toast, no dialog. The form simply resets. The password field's own placeholder reads "leave blank to auto-generate", so the platform generates one, and because nothing is shown it is never revealed to anybody. The pharmacy is left with an ACTIVE account whose password no one knows, and it cannot be recovered: admin password reset on this service already returns 503. The section is titled "Set these now to hand the pharmacy a one-pager with everything they need", which is exactly what cannot be done.

**Covers test cases:** `REG_RPH_007`

---

**Steps to Reproduce:**

1. Connect the Citrix VPN and open https://192.168.225.195:8445.
2. Log in as inspector@masar.local.
3. Click Register Pharmacy.
4. Enter a unique GLN with a valid GS1 check digit, a pharmacy name, a governorate, a phone number, an address and a tax id.
5. Click the location map to drop the required pin.
6. Tick Generate login account and enter a login email, leaving the Password field blank.
7. Click Register pharmacy.
8. Watch the page for any success panel, toast or dialog.
9. Open Parties, search for the GLN, and click the Accounts action on the new row.

---

**Expected Result:**
The registration reports success and displays the credentials it created once, including the generated password, so the pharmacy can be handed the one-pager the form promises.

---

**Actual Result:**
Nothing is displayed: no panel, no toast, no dialog, and the form resets. Parties nevertheless shows the new party as ACTIVE, and its Accounts dialog lists the account as ACTIVE with the login email supplied, so both were created while the generated password was never revealed.

---

**Environment:**
Platform: Web (Chromium 152) via Citrix VPN
Registry portal: https://192.168.225.195:8445 (Keycloak client `registry-portal`, realm `masar`)
Tenant: devsim, logged in as inspector@masar.local (role inspector, GLN 9999999999999)
Party created: GLN 8888814096592, name ZZ QA TEST PHARMACY 14096592, type PHARMACY, group DISPENSER, status ACTIVE, licence Pending, created 9/9/2026 3:36:55 AM
Account created: zz-qa-14096592@example.invalid, role PHARMACY, status ACTIVE, last login empty
Related: admin password reset returns 503 on this service, so a lost password cannot be reset either
TLS: self-signed certificate (clients must ignore certificate errors)

---

**Priority:**
P1 – Critical

---

**Bug Type:**
Functional
