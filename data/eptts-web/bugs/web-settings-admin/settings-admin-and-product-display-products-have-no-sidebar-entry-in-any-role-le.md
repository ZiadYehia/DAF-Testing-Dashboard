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

- `/admin` — "Settings", the platform administration surface, carrying **15 tabs**: Government, Manufacturer, Distributor, Dispenser, System, Platform, System Configuration, Pharmacies, Pharmacy Admins, POS Partners, B2B Partners, Platform Staff, User Locks and Geography.
- `/products` — "Product Display".

Both load and function correctly when the URL is typed. The complete admin sidebar contains no "Settings" and no "Products" label, so the highest-privilege page in the product can only be reached by someone who already knows the path.
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
1. Every reachable page has a navigation entry appropriate to the user's role, or is deliberately unlisted and documented as such.
---
**Actual Result:**
1. The sidebar contains no "Settings" and no "Products" entry — confirmed programmatically against the full sidebar text.
2. /admin loads "Settings" with 15 working tabs.
3. /products loads "Product Display".
4. Neither page is reachable by clicking anywhere in the UI.
---
**Environment:**
- Platform: Web (Chromium 149) via Citrix VPN
- Dashboard: https://192.168.225.195:8444 (Angular SPA, Keycloak OIDC realm `masar`)
- Tenant: devsim, logged in as admin@devsim.local (role admin, GLN 9999999999999)
- TLS: self-signed certificate (clients must ignore certificate errors)
---
**Priority:**
P2 – High
---
**Bug Type:**
UI/UX
---
**Notes:**
Attached `nav-orphan-pages.webm` shows the full sidebar, then both pages loading by direct URL. This is a separate defect from the empty-sidebar-groups bug: those groups exist but have no children, whereas these two pages have no menu entry at all.
