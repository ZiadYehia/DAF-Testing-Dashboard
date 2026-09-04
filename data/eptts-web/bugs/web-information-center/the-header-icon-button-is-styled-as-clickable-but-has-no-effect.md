---
title: >-
  [Information Center] The header icon button is styled as clickable and
  carries a title, but clicking it has no effect
status: draft
jira_key: null
reported_at: null
feature: web-information-center
priority: P4 – Low
bug_type: UI/UX
parent_key: null
severity: ''
layer: frontend
jira_status: ''
jira_reporter: ''
found_by: Ziad Yehia
found_at: '2026-09-02T12:55:00.000Z'
---
The icon button to the left of the AR/EN toggle in the page header is a real PrimeNG button: it has `title="Information Center"`, a pointer cursor and a ripple effect on press. Clicking it does nothing at all — no navigation, no dialog, no overlay, no toast, and the URL and page content are unchanged. Hovering produces no tooltip despite the title attribute. The control beside it, the user chip, does respond by opening the Profile dialog, so the two are indistinguishable in appearance while only one works.

**Covers test cases:** `WEB_INF_031`

---

**Steps to Reproduce:**

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Log in as admin@devsim.local.
3. Open https://192.168.225.195:8444/information-center.
4. Hover the icon button immediately to the left of the AR toggle in the page header and wait for a tooltip.
5. Click that icon button.
6. Observe the URL, the page body, the toast area and the overlay layer.
7. Click it twice more and observe the same four places again.

---

**Expected Result:**
The control performs the action its title names, or it is not presented as an interactive button.

---

**Actual Result:**
Three consecutive clicks produce no navigation, no dialog, no overlay and no toast, and no tooltip appears on hover.

---

**Environment:**
Platform: Web (Chromium 152) via Citrix VPN
Dashboard: https://192.168.225.195:8444 (Angular SPA, PrimeNG, Keycloak OIDC realm `masar`)
Tenant: devsim, logged in as admin@devsim.local (role admin, GLN 9999999999999)
Page: /information-center
TLS: self-signed certificate (clients must ignore certificate errors)

---

**Priority:**
P4 – Low

---

**Bug Type:**
UI/UX
