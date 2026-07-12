---
type: rules
priority: 10
---
<!-- generated-from-intake -->
# Test-Case Writing Rules

## ID scheme

Flat module-prefix + 3-digit zero-padded counter, no role component (Masar Agent has no role system): AUTH_001 (Authentication), RCV_001 (Receive), SEL_001 (Sell/Dispense), RET_001 (Return), RTD_001 (Return to Distributor), QUE_001 (Queue). Counter resets to _001 per feature module file, is strictly sequential, and never skips numbers.

## Required fields / table format

Every test case file starts with a single H1 heading (module name) followed by one markdown table with these exact 13 columns in order (case-sensitive, preserve spacing/typos): Feature ID | TestCase ID | Tester | Validity | Test Cases Title / Objective | Environment | Pre-condition | Test Data | Steps | Expected Results | Status | Attachment | Type. Feature ID must reference a valid ID from requirements/FRs.md (space-separated if multiple, e.g. 'EPTTS_FR_07 EPTTS_FR_09'). Status values: Pass, Fail (requires Attachment bug ID), Blocked/Skipped, Under Testing. Attachment is empty unless Status=Fail, in which case it holds a DW-### Jira bug ID (EPTTS and Dawana share the same Jira board/prefix; multiple IDs space-separated). Type is always 'Functional'.

## Style rules

Steps are a numbered list on a single line inside the cell: '1. {Action}. 2. {Action}. 3. {Action}.' Each step is exactly one atomic action using verbs like Click, Enter, Select, Scan, Copy, Paste, Observe, Navigate, Open, Disable, Enable, Leave, Wait, Scroll, Retry, Confirm, Minimize, Restore, Pull to refresh. Use 'Paste' for DataMatrix copy/paste input and 'Scan' for barcode-scanner input; since this is a desktop app, never use 'Tap' — always 'Click'. 'Observe {element/behavior}' is used for passive checks, and 'Leave {field} empty' for empty-field tests. Max ~10 steps per test (split into multiple tests if more are needed); 'Repeat steps X-Y' is acceptable for repetition. Steps must not repeat pre-condition steps and must flow logically from the pre-condition's ending state. Pre-conditions themselves are also a single-line numbered list, e.g. for non-auth modules: '1. Install Masar Agent 2. Access to Internet (Wifi or Ethernet) 3. Launch the app 4. Login with a valid pharmacy account 5. OTP verified 6. Activation key validated 7. Open {Module Name} module 8. User is on {Screen Name} screen' (auth-module tests drop steps 4-7's login-related items since login IS the test; offline/network-failure tests insert a 'Disable internet connection' step before opening the module). Expected Results are single declarative present-tense sentences with NO modal verbs (no should/will/would/shall), naming the exact system behavior (e.g., 'Pack state changes to Active and transaction appears in History and Queue.'); unclear business rules get '(as per business rules)' or '(TBD with PO)' appended. Test Data uses 'Not Applicable' (never 'N/A') when nothing specific is needed, 'FieldName: value' format for specific values, and semicolon-separated for multiples (e.g. 'DataMatrix: <value>; Quantity: 2').

## Priority scale

Test cases themselves don't carry a priority column, but the underlying Functional Requirements (FRs.md) are tiered P1/P2/P3 (P1 = core auth/receive/sell/queue flows; P2 = return/return-to-distributor/history; P3 = settings/products-catalog/keyboard-shortcuts). Bugs use a 4-level priority scale: P1 – Critical | P2 – High | P3 – Medium | P4 – Low (observed values in practice: 'P1', 'P2 – High', 'P2', 'P3' — the em-dash + word suffix is the documented/canonical form from the bug template).
