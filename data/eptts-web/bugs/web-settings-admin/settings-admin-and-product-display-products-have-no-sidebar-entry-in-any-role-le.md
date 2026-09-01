---
title: >-
  [Navigation] Settings (/admin) and Product Display (/products) have no
  sidebar entry in any role, leaving the 15-tab administration surface
  unreachable
status: draft
jira_key: null
reported_at: null
feature: web-settings-admin
priority: P2 – High
bug_type: UI/UX
parent_key: null
severity: ''
layer: unknown
jira_status: ''
jira_reporter: ''
found_by: Ziad Yehia
found_at: '2026-08-31T10:05:00.000Z'
---
Two working pages are absent from the navigation entirely — not hidden behind an empty group, but with no menu entry of any kind:

---

**Steps to Reproduce:**

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Log in as admin@devsim.local and switch the UI to EN.
3. Read every entry in the sidebar and search for "Settings" or "Products".
4. Enter https://192.168.225.195:8444/admin directly in the address bar.
5. Observe the page and count its tabs.
6. Enter https://192.168.225.195:8444/products directly.
7. Observe the page.

---

**Expected Result:**
Every reachable page has a navigation entry appropriate to the user's role, or is deliberately unlisted and documented as such.

---

**Actual Result:**
The sidebar contains no "Settings" and no "Products" entry — confirmed programmatically against the full sidebar text; /admin loads "Settings" with 15 working tabs; /products loads "Product Display"; neither page is reachable by clicking anywhere in the UI.

---

**Environment:**
Platform: Web (Chromium 149) via Citrix VPN
Dashboard: https://192.168.225.195:8444 (Angular SPA, Keycloak OIDC realm `masar`)
Tenant: devsim, logged in as admin@devsim.local (role admin, GLN 9999999999999)
TLS: self-signed certificate (clients must ignore certificate errors)

---

**Priority:**
P2 – High

---

**Bug Type:**
UI/UX
