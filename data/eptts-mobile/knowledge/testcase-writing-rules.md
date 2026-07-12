---
type: rules
priority: 10
---
<!-- generated-from-intake -->
# Test-Case Writing Rules

## ID scheme

EPTTS-M-<FEATURE>-TC-<NNN> (e.g. EPTTS-M-LOGIN-TC-001); the 'M' denotes Mobile to distinguish from any web/EPTTS test suites; FEATURE is an uppercase short slug for the feature/module (LOGIN, PHARMACY-DISPENSE, DISTRIBUTOR-CREATE-SHIPMENT, INSPECTOR-TRACE, PATIENT-VALIDATE, etc.); NNN is a zero-padded 3-digit sequence per feature.

## Required fields / table format

Each test case is a Markdown file/table with: Test ID, Title, Module/Role (Pharmacy/Branch/Distributor/Inspector/Patient), Platform (Android / iOS / Both — mandatory per test-writing rules), Preconditions (login role/account, online/offline state, existing data such as an available invoice/shipment/pack), Steps (numbered, one user action or validation point per step), Expected Result per step or at the end, Priority (P1-P4), and Status. Scan-related test cases must note whether a physical scanner or the camera/manual-entry path is used. Offline/online state must be explicitly declared whenever the case touches sync-sensitive flows (Receive, Dispense, Return, Create/Receive Shipment, EPCIS History).

## Style rules

Steps are written as short, literal, numbered user actions matching the actual on-screen labels and content-desc values discovered via Appium exploration (e.g. 'Tap Sign In', 'Enter credentials for <role>', 'Tap Receive Invoice', 'Tap Scan Barcode', 'Scan pack barcode X', 'Verify progress bar shows 1/3', 'Tap Initiate Return'). Each step covers exactly one user action or one validation point (per testcase-writing-rules.md) — no compound steps. Preconditions specify the exact test account/role and any required app state (e.g. an existing Dispatched invoice, a PENDING return, a pack already in pharmacy inventory). Expected results are stated precisely against the verified UI text/labels captured in the workflow.md files (e.g. exact button/tab labels, status badge text such as CONFIRMED/PENDING/CANCELLED, Completed/Failed, Draft/Dispatched/Delivered/Partially Delivered) rather than paraphrased.

## Priority scale

P1 = Critical/core happy-path flow for a role (e.g. Login, Pharmacy Dispense, Distributor Create Shipment, Inspector Trace, Patient Validate Pack) — must-pass before release. P2 = Secondary/supporting flows (e.g. Return Pack, Branch Return, My Returns, EPCIS History, Returns sub-menu detail actions). P3-P4 = Edge cases, validation-rule checks, and rarely-hit states (empty lists, duplicate scans, invalid barcodes, network errors, token-expiry/Unauthorized handling) — most of these are currently marked '(To be discovered through testing)' in the source docs and should be fleshed out as exploration continues.
