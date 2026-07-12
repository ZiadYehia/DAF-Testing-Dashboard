<!-- generated-from-intake -->
# Test-Case Generation Process

## Coverage expectations

Coverage should span, per role, the full happy path plus the edge cases already enumerated in each feature's workflow.md: invalid/unrecognized barcodes, duplicate scans ('Already scanned'), pack not in inventory / already dispensed / already returned, partial completion (Partially Delivered shipments, partial return acceptance), empty-state lists, network/server errors with retry, and status-filter edge cases (e.g. Failed filter with none present). Include the shared/cross-cutting flows once per suite rather than per role where UI is identical: Logout (confirmation dialog Confirm/Cancel), Delete Account (destructive confirmation), and 15-minute token-expiry/Unauthorized handling (Retry button is known non-functional — flag as a bug candidate rather than expected behavior). GS1 scan test cases should be covered for both the camera-scan path and, where a physical scanner is used, that path noted separately. Both Android and iOS should be covered explicitly per the 'platform' rule, even though iOS capabilities/device are not yet verified live (appium-capabilities.json iOS udid is a placeholder).
