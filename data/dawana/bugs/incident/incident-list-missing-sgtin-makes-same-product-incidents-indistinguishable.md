---
title: Incident list does not display SGTIN, making same-product incidents created on the same day indistinguishable in Inspector and Manager views
status: draft
jira_key: null
reported_at: null
feature: incident
priority: P2
bug_type: Functional
---

Incident list does not display SGTIN, making same-product incidents created on the same day indistinguishable in Inspector and Manager views

In the Incident module, the incident list shown to both the Pharmacy Manager and Inspector displays only five fields per entry: date created, product name, batch number, expiry date, and quantity. No serialized identifier — SGTIN or serial number — is included.

This becomes a functional problem when two incidents are submitted for different serialized units of the same product on the same day, which is a valid scenario (e.g., two Damaged packs from the same batch reported separately). Because all five visible fields are identical across both entries, the Inspector has no information to distinguish between them before making an accept or reject decision. Acting on the wrong incident is an entirely plausible outcome.

Since the SGTIN (GTIN + serial number) uniquely identifies each serialized pack, displaying it in the incident list row would allow both Managers and Inspectors to unambiguously trace each incident entry back to its specific physical unit.

---

**Precondition:**
Two incidents exist in the Inspector's queue, both submitted on the same day, for different serialized units of the same product sharing identical batch, expiry, and quantity values.

---

**Steps to Reproduce:**

1. Log in as **Pharmacy Manager**
2. Open the **Incident** module
3. Create a new incident — scan serialized unit **A** of any product, select an incident reason (e.g., Damaged), and submit
4. Create a second incident — scan a different serialized unit **B** of the **same product** (same GTIN, same batch, same expiry, quantity = 1, same reason), and submit
5. Switch to the **Inspector** account on the same device
6. Open the **Incident** module and navigate to the incident list
7. Observe both incident entries side by side

---

**Expected Result:**
Each incident entry displays the SGTIN (or at minimum the serial number) of the affected unit, enabling the Inspector to uniquely identify which serialized pack each incident refers to before acting on it.

**Actual Result:**
Both entries display identical information — date, product name, batch, expiry, and quantity — with no SGTIN or serial number visible, making it impossible for the Inspector to distinguish between the two incidents.

---

**Environment:**
- Device: Samsung Galaxy Note 10+
- OS: Android 12
- App: Dawana v5.3.1
- Accounts: Pharmacy Manager + Inspector (same device, account switching)

---

**Priority:** P2 – High

**Bug Type:** Functional
