---
title: >-
  [Announcements] Every row action button is icon-only with no title and no
  aria-label, so its purpose is unavailable to assistive technology
status: draft
jira_key: null
reported_at: null
feature: web-announcements
priority: P3 – Medium
bug_type: UI/UX
parent_key: null
severity: ''
layer: frontend
jira_status: ''
jira_reporter: ''
found_by: Ziad Yehia
found_at: '2026-09-02T12:48:00.000Z'
---
The Actions column renders between four and five icon-only buttons per row depending on status — edit, audience, history, submit or approve, archive and delete. Not one of them carries a `title`, an `aria-label` or any text content, so a screen reader announces each simply as "button" and a sighted user gets no tooltip on hover. Two of these actions are destructive or state-changing in ways that cannot be undone from the UI: the trash action deletes the announcement and the archive action retires a published one, and neither is distinguishable from the others without recognising the icon.

**Covers test cases:** `WEB_ANN_016`

---

**Steps to Reproduce:**

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Log in as admin@devsim.local.
3. Open https://192.168.225.195:8444/admin/announcements.
4. Hover each button in the Actions column of any row and wait for a tooltip.
5. Open the browser developer tools and inspect each of those buttons.
6. Read the title attribute, the aria-label attribute and the text content of each.

---

**Expected Result:**
Each action button carries a title or an aria-label naming the action it performs.

---

**Actual Result:**
Every button in the Actions column returns null for both title and aria-label and has empty text content, so no tooltip appears on hover and a screen reader announces only "button".

---

**Environment:**
Platform: Web (Chromium 152) via Citrix VPN
Dashboard: https://192.168.225.195:8444 (Angular SPA, PrimeNG, Keycloak OIDC realm `masar`)
Tenant: devsim, logged in as admin@devsim.local (role admin, GLN 9999999999999)
Page: /admin/announcements
TLS: self-signed certificate (clients must ignore certificate errors)

---

**Priority:**
P3 – Medium

---

**Bug Type:**
UI/UX
