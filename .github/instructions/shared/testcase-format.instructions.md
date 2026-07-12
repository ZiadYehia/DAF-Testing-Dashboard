---
description: "Test case table format, column order, naming conventions, and writing rules. Auto-loaded when editing or creating any test case file."
applyTo: "data/**/features/**/*-testcases.md"
---

When editing or creating any `*-testcases.md` file, enforce the following rules.
Always read `data/<app>/knowledge/testcase-writing-rules.md` for the complete rule set before making any changes.

## Required Column Order (13 columns — exact)

`Feature ID | TestCase ID | Tester | Validity | Test Cases Title / Objective | Enviroment | Pre-condition | Test Data | Steps | Expected Results | Status | Attachment | Type`

> The header spelling **"Enviroment"** (missing the second 'n') is intentional. Preserve it exactly.

## Non-Negotiable Values

| Column | Required Value |
|--------|----------------|
| Tester | the app's configured tester name |
| Type | `Functional` |
| Test Data (when empty) | `Not Applicable` — never "N/A" |
| Validity | `Positive` or `Negative` only |
| Status | `Pass`, `Fail`, `Blocked/Skipped`, or `Under Testing` |
| Attachment | Bug ID (`DW-###`) only when Status = `Fail`; empty otherwise |

## TestCase ID Format

- 3-digit zero-padded counter: `_001`, `_002`, ..., `_100`
- Cross-role/general: `{ABBREV}_{###}` → `LGN_001`, `DSP_001`
- Role-specific: `{ROLE}_{ABBREV}_{###}` → `MGR_INC_001`, `OWN_RCH_001`
