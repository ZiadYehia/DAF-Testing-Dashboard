---
title: Branch role cannot receive packs using SSCC in the Receive Shipment flow
status: reported
jira_key: DW-853
reported_at: '2026-07-13T08:58:43.424Z'
feature: branch-receive-shipment
priority: P1 – Critical
bug_type: Functional
parent_key: null
severity: ''
layer: frontend
jira_status: DONE
jira_reporter: '712020:b6f2ccdf-1ea7-4b3c-85ca-0bf6ed8291ed'
---
The Branch role in EPTTS Mobile lacks the functionality to receive packs by scanning SSCC (Serial Shipping Container Code) barcodes within the 'Receive Shipment' module. Currently, only individual pack (SGTIN) scanning appears to be supported, which can significantly slow down the receiving process for bulk shipments. This omission impacts operational efficiency and may lead to non-compliance with standard logistics practices where SSCC is used for container-level receiving.

---

**Steps to Reproduce:**
1. Log in as a Branch user (e.g., testbranch@eptts.com).
2. From the Home screen, tap 'Receive Shipment'.
3. Select an incoming shipment from the 'Incoming Invoices' list.
4. Observe the scanning interface.
5. Attempt to scan an SSCC barcode for a container of packs.

---

**Expected Result:**
The system should provide an option or automatically recognize and process SSCC scans, allowing the Branch user to receive multiple packs contained within that SSCC. The progress bar should update accordingly for all packs within the scanned container.

---

**Actual Result:**
There is no explicit option or functionality to scan and receive packs using an SSCC barcode. The interface appears to only support individual SGTIN pack scanning, requiring each pack to be scanned separately.

---

**Environment:**
Device: Samsung Galaxy Note 10+ — Android 12 (primary verified device)
Platform: EPTTS Mobile (com.daf.eda.eptts) — native Android/iOS app, no web environment/URL
App Version: 
Role/Account: Branch (testbranch@eptts.com)
Network state: Online

---

**Priority:** P1 – Critical

---

**Bug Type:** Functional
