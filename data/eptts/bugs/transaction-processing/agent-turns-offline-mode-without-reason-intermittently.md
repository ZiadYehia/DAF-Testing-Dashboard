---
title: Agent turns offline mode without reason intermittently
status: draft
jira_key: null
reported_at: null
feature: transaction-processing
priority: P2 – High
bug_type: Functional — Intermittent / Flaky
---
The Agent application switches to offline mode without any apparent reason or warning, causing disruptions to ongoing transactions and pharmacy operations. This issue occurs intermittently, making it challenging to identify a specific pattern or trigger.

---
**Steps to Reproduce:**
1. Launch the Agent application and ensure it is online.
2. Perform various transactions such as receiving, selling, or returning products.
3. Observe the application's behavior over time.

---
**Expected Result:**
The Agent application should remain in online mode unless there is a legitimate reason for it to switch to offline mode, such as a loss of internet connection.

---
**Actual Result:**
The Agent application intermittently switches to offline mode without any apparent reason, even when the internet connection is stable.

---
**Environment:**
- Windows version: 10
- Agent Version: 2.3.5
- Online or Offline state at time of issue: Online

---
**Priority:**
P2 – High

---
**Bug Type:**
Functional — Intermittent / Flaky
