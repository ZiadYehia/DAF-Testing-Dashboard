---
title: >-
  Keyboard shortcut 'Ctrl + 4' fails to navigate to 'Return to Distributor'
  module instead of opening the screen
status: reported
jira_key: DW-795
reported_at: '2026-06-07T08:39:48.045Z'
feature: return-to-distributor
priority: P3
bug_type: Functional
---
The keyboard shortcut 'Ctrl + 4', which is designed to provide quick navigation to the 'Return to Distributor' module, is currently non-functional. When a user attempts to use this shortcut, the application does not switch to the intended module, requiring manual navigation and impacting workflow efficiency.

---

**Steps to Reproduce:**

1. Launch the Masar Agent application and log in successfully with a valid pharmacy account.
2. Navigate to any active module screen (e.g., Receive, Sell).
3. Press the `Ctrl + 4` keyboard combination.

---

**Expected Result:**
The system navigates to the 'Return to Distributor' module screen.

---

**Actual Result:**
The system does not navigate to the 'Return to Distributor' module screen, and the current screen remains unchanged.

---

**Environment:**
- Windows 10/11
- Agent Version: v2.3.7
- Online or Offline state: Online

---

**Priority:**
P3 – Medium

---

**Bug Type:**
Functional
