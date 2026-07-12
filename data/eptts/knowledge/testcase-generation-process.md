# Test Case Generation Process — EPTTS Masar Agent

The QA workflow for Masar Agent is:

1. Create Functional Requirements (FRs)
2. Break module into features
3. Assign:
   - Feature ID
   - Priority
   - Status
4. Analyze screenshots and workflow
5. Generate test scenarios
6. Generate detailed test cases

The AI MUST follow this workflow.

---

## Modules

The Masar Agent has the following core modules:

| Module | Description | TestCase Prefix |
|--------|-------------|-----------------|
| Authentication & Activation | Login, OTP, activation key, device linking | `AUTH_` |
| Receive | Receive packs from distributor (InTransit → Active) | `RCV_` |
| Sell / Dispense | Dispense packs to patient (Active → Dispensed / Partial Dispensed) | `SEL_` |
| Return | Patient returns item to pharmacy (Dispensed / Partial Dispensed → Returned) | `RET_` |
| Return to Distributor | Pharmacy returns Active packs back to distributor/branch | `RTD_` |
| Queue | Technical sync log — Pending / Failed / Synced transactions | `QUE_` |

---

## Role Context

Masar Agent has **no role system**. Only pharmacy users operate the application.

- All test cases are written from the **pharmacy user** perspective.
- There are no Owner / Manager / Pharmacist / Inspector role distinctions.
- Do NOT add role prefixes to TestCase IDs.
- Do NOT write role-isolation test cases.

Instead, cover **access control** scenarios using device deactivation and pharmacy unlink flows where applicable.

---

## Feature ID Traceability

Each test case must be linked to a valid Feature ID from `data/eptts/requirements/FRs.md`.

Example:
`EPTTS_FR_01` → Authentication (Login)

All generated test cases must maintain requirement traceability.
