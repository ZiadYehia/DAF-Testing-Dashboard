---
title: Pack URN not found error when receiving single pack from SSCC
status: reported
jira_key: DW-801
reported_at: '2026-06-08T07:14:15.616Z'
feature: receive
priority: P2 – High
bug_type: Functional
---

### Summary
The user is experiencing an issue when trying to receive a single pack from an SSCC. After pasting the DataMatrix and confirming the receive, an error appears stating that the pack URN is not found.

### Steps to Reproduce:
1. Open the Receive module.
2. Scan or paste the SSCC DataMatrix.
3. Select the pack to receive individually.
4. Paste the DataMatrix of the individual pack.
5. Confirm the receive.

### Expected Result:
The pack should be successfully received, and its state should be updated to Active. The transaction should appear in the History and Queue.

### Actual Result:
An error message appears stating that the pack URN is not found. The error message specifically mentions the pack URN as 'pack urn:epc:id:sgtin:6290009.099001.testagent000007' which is part of the SSCC '054138684703155585'.

### Environment:
- Platform: Windows 10/11
- App: Masar Agent v2.4.0
- Internet connection: Available

### Priority:
P2 – High.

### Bug Type:
Functional.
