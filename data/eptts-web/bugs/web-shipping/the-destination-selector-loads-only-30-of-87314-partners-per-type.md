---
title: >-
  [Shipping] The destination selector loads only 30 partners per type, so 87,284
  of 87,314 pharmacies cannot be shipped to
status: draft
jira_key: null
reported_at: null
feature: web-shipping
priority: P2 – High
bug_type: Functional
parent_key: null
severity: ''
layer: unknown
jira_status: ''
jira_reporter: ''
found_by: Ziad Yehia
found_at: '2026-09-02T14:08:00.000Z'
---
Opening the Destination selector fires four calls to the registry, one per entity type, each hard-coded to `limit=30&offset=0`: distributor, pharmacy, hospital and branch. Ninety options load in total and that is the entire selectable universe — there is no pagination control, no infinite scroll and no server-side lookup, and the filter box only narrows the ninety already held in memory. The pharmacy call answers `{"items":[…30 items…],"total":87314}`, so the platform knows there are 87,314 and offers thirty. Any trade partner outside those first pages simply cannot be chosen as a shipment destination.

**Covers test cases:** `WEB_SHP_008`

---

**Steps to Reproduce:**

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Log in as admin@devsim.local.
3. Open https://192.168.225.195:8444/shipments.
4. Open the browser developer tools on the Network tab.
5. Click the Destination selector and count the options offered.
6. Read the four requests to registry-service/api/v1/entities and note the limit parameter on each.
7. Open the response of the request whose type is pharmacy and read the total field.
8. Type the name of a pharmacy that is not among the thirty loaded and observe the filtered list.

---

**Expected Result:**
Every registered trade partner can be selected as a destination, through pagination or a server-side search.

---

**Actual Result:**
Only 90 options ever load, 30 per entity type from `limit=30&offset=0`, while the pharmacy endpoint reports a total of 87,314; a partner outside the loaded set cannot be found or selected.

---

**Environment:**
Platform: Web (Chromium 152) via Citrix VPN
Dashboard: https://192.168.225.195:8444 (Angular SPA, PrimeNG, Keycloak OIDC realm `masar`)
Registry: https://192.168.225.195:8445/registry-service/api/v1/entities?type={distributor|pharmacy|hospital|branch}&limit=30&offset=0
Tenant: devsim, logged in as admin@devsim.local (role admin, GLN 9999999999999)
TLS: self-signed certificate (clients must ignore certificate errors)

---

**Priority:**
P2 – High

---

**Bug Type:**
Functional
